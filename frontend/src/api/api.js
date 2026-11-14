// The only place that talks to the backend. Components import these functions and never call fetch.
// Response shapes: docs/DESIGN.md §6. Mock mode returns the same shapes from ./mock/.
//
// .env:  VITE_USE_MOCK=true|false   VITE_API_URL=http://localhost:8000
//
// Slow endpoints (getFrames, getDiff, getRgb) may answer 202 while the backend works.
// These functions hide that: they poll every 2 s and resolve with the final result.
// Pass { onProgress } to see progress, e.g. for the status bar:
//   onProgress({ status: "queued", position: 1 })
//   onProgress({ status: "processing", done: 40, total: 120 })
// Pass { signal } (an AbortController signal) to stop polling when the user changes target.
//
// 429 / 503 are retried up to 4 times (waiting Retry-After, else 2, 4, 8, 16 s), reported as
//   onProgress({ status: "retrying", httpStatus: 503, attempt: 1, retryInMs: 2000 })
//
// The same progress updates also go to subscribeActivity(listener), so the status bar can show
// them without every caller passing callbacks around.

import healthMock from "./mock/health.json";
import resolveMock from "./mock/resolve.json";
import targetsMock from "./mock/targets.json";
import framesMock from "./mock/frames.json";
import diffMock from "./mock/diff.json";
import rgbMock from "./mock/rgb.json";
import contextMock from "./mock/context.json";
import explainMock from "./mock/explain.json";
import trackMock from "./mock/track.json";
import spectrumMock from "./mock/spectrum.json";
import lightcurveMock from "./mock/lightcurve.json";

export const USE_MOCK = import.meta.env.VITE_USE_MOCK === "true";
export const API_URL = (import.meta.env.VITE_API_URL || "http://localhost:8000").replace(/\/$/, "");

const POLL_MS = 2000;
const MAX_RETRIES = 4; // for 429 / 503
const RETRY_STATUSES = [429, 503];
const IMAGES_AS_URLS = "url"; // backend sends base64 images inside the JSON unless asked for URLs

export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.name = "ApiError";
    this.status = status; // 404 no data · 422 bad params · 429 rate limited · 502 IRSA failed · 503 IRSA busy
  }
}

// ---------- endpoints ----------

/** {ok, release, latest_data_date, pipeline_version, jobs_running, jobs_queued} */
export function getHealth(opts) {
  return call("/api/health", {}, opts, () => healthMock);
}

/** The challenge's test objects, positions moved to the SPHEREx era → [{id, name, ra, dec, note}] */
export function getTargets(opts) {
  return call("/api/targets", {}, opts, () => targetsMock);
}

/** "WISE 0855" → {name, ra, dec} */
export function resolve(name, opts) {
  return call("/api/resolve", { name }, opts, () => {
    const hit = resolveMock[String(name).toLowerCase().replace(/[^a-z0-9]/g, "")];
    if (!hit) throw new ApiError(`Could not resolve "${name}"`, 404);
    return hit;
  });
}

/** {ra, dec, fov, det, mode, wmin, wmax} → {frames: [...], grid} */
export function getFrames({ ra, dec, fov, det, mode, wmin, wmax }, opts) {
  return call("/api/frames", { ra, dec, fov, det, mode, wmin, wmax, images: IMAGES_AS_URLS },
    { ...opts, poll: true }, () => framesMock, withImageUrls);
}

/** Difference (op "sub", b − a) or sum (op "add") of frames a and b → {url} */
export function getDiff({ ra, dec, fov, det, mode, wmin, wmax, a, b, op = "sub" }, opts) {
  return call("/api/diff", { ra, dec, fov, det, mode, wmin, wmax, a, b, op, images: IMAGES_AS_URLS },
    { ...opts, poll: true }, () => diffMock, withImageUrls);
}

/** Infrared colour image (D1 blue, D3 green, D6 red) → {url} */
export function getRgb({ ra, dec, fov }, opts) {
  return call("/api/rgb", { ra, dec, fov }, { ...opts, poll: true }, () => rgbMock, withImageUrls);
}

/** Verdict for a clicked position at a frame's date → {verdict, match, stars, asteroids, warnings} */
export function getContext({ ra, dec, fov, mjd }, opts) {
  return call("/api/context", { ra, dec, fov, mjd }, opts, () => contextMock);
}

/** Plain-language text for the verdict → {text, source: "template" | "llm"} */
export function getExplain({ ra, dec, mjd }, opts) {
  return call("/api/explain", { ra, dec, mjd }, opts, () => explainMock);
}

/** Measured positions vs. catalog motion → {measured: [...], catalog_pm, fit} */
export function getTrack({ ra, dec }, opts) {
  return call("/api/track", { ra, dec }, opts, () => trackMock);
}

/** {points: [{wavelength_um, flux, error, mjd, det}]} */
export function getSpectrum({ ra, dec }, opts) {
  return call("/api/spectrum", { ra, dec }, opts, () => spectrumMock);
}

/** {points: [{mjd, flux, error}]} */
export function getLightcurve({ ra, dec, det }, opts) {
  return call("/api/lightcurve", { ra, dec, det }, opts, () => lightcurveMock);
}

// ---------- activity feed (for the status bar) ----------

const activityListeners = new Set();
let lastRequestId = 0;

/**
 * listener({ id, status, ... }) is called with every progress update of every request
 * (same objects as onProgress, plus a request id), and with { id, status: "settled" } at the end.
 * Returns an unsubscribe function.
 */
export function subscribeActivity(listener) {
  activityListeners.add(listener);
  return () => {
    activityListeners.delete(listener);
  };
}

/** One reporter per request: sends each update to the caller's onProgress and to the feed. */
function createReporter(onProgress) {
  const id = ++lastRequestId;
  const emit = (event) => activityListeners.forEach((listener) => listener({ id, ...event }));
  return {
    progress(info) {
      onProgress?.(info);
      emit(info);
    },
    settle: () => emit({ status: "settled" }),
  };
}

// ---------- internals ----------

async function call(path, params, opts = {}, mock, transform = (x) => x) {
  const reporter = createReporter(opts.onProgress);
  try {
    const body = USE_MOCK ? await fakeCall(mock, opts, reporter) : await request(path, params, opts, reporter);
    return transform(body, { mock: USE_MOCK });
  } finally {
    reporter.settle();
  }
}

function buildUrl(path, params) {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== null && v !== undefined && v !== "") p.set(k, String(v));
  }
  const qs = p.toString();
  return `${API_URL}${path}${qs ? `?${qs}` : ""}`;
}

async function request(path, params, { signal, poll = false }, reporter) {
  const url = buildUrl(path, params);
  let retries = 0;
  for (;;) {
    const res = await fetch(url, { signal });
    const body = await res.json().catch(() => ({}));

    if (res.status === 202 && poll) {
      reporter.progress(body); // { status: "queued", position } | { status: "processing", done, total }
      await sleep(POLL_MS, signal);
      continue;
    }
    if (RETRY_STATUSES.includes(res.status) && retries < MAX_RETRIES) {
      retries += 1;
      const retryInMs = retryDelayMs(res, retries);
      reporter.progress({ status: "retrying", httpStatus: res.status, attempt: retries, retryInMs });
      await sleep(retryInMs, signal);
      continue;
    }
    if (!res.ok) throw new ApiError(body.detail || `HTTP ${res.status}`, res.status);
    return body;
  }
}

/** Server's Retry-After (seconds) if given, else exponential backoff: 2, 4, 8, 16 s. */
function retryDelayMs(res, attempt) {
  const seconds = Number(res.headers.get("Retry-After"));
  if (Number.isFinite(seconds) && seconds > 0) return seconds * 1000;
  return POLL_MS * 2 ** (attempt - 1);
}

// Backend image URLs are relative ("/img/abc.png"): make them absolute so they work from Vercel.
// Mock URLs point at frontend/public/mock/ and stay relative to the frontend.
// Frames without an id (the backend sends only `index`) get their URL as id, which is unique per image.
function withImageUrls(body, { mock }) {
  const absolute = (u) => (!mock && u?.startsWith("/") ? API_URL + u : u);
  if (Array.isArray(body.frames)) {
    const frames = body.frames.map((f) => {
      const url = absolute(f.url);
      return { ...f, url, flags_url: absolute(f.flags_url), id: f.id ?? url };
    });
    return { ...body, frames };
  }
  return { ...body, url: absolute(body.url) };
}

// Mock: short delay, and a fake queued → processing phase for polling endpoints.
async function fakeCall(mock, { signal, poll = false }, reporter) {
  if (poll) {
    reporter.progress({ status: "queued", position: 1 });
    await sleep(300, signal);
    for (let done = 1; done <= 3; done++) {
      reporter.progress({ status: "processing", done, total: 3 });
      await sleep(200, signal);
    }
  } else {
    await sleep(150, signal);
  }
  return structuredClone(mock());
}

function sleep(ms, signal) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(signal.reason ?? new DOMException("Aborted", "AbortError"));
    const t = setTimeout(resolve, ms);
    signal?.addEventListener("abort", () => {
      clearTimeout(t);
      reject(signal.reason ?? new DOMException("Aborted", "AbortError"));
    }, { once: true });
  });
}
