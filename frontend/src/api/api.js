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

import healthMock from "./mock/health.json";
import resolveMock from "./mock/resolve.json";
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
  return call("/api/frames", { ra, dec, fov, det, mode, wmin, wmax }, { ...opts, poll: true },
    () => framesMock, withImageUrls);
}

/** Difference (op "sub", b − a) or sum (op "add") of frames a and b → {url} */
export function getDiff({ ra, dec, fov, det, mode, wmin, wmax, a, b, op = "sub" }, opts) {
  return call("/api/diff", { ra, dec, fov, det, mode, wmin, wmax, a, b, op }, { ...opts, poll: true },
    () => diffMock, withImageUrls);
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

// ---------- internals ----------

async function call(path, params, opts = {}, mock, transform = (x) => x) {
  if (USE_MOCK) return transform(await fakeCall(mock, opts), { mock: true });
  return transform(await request(path, params, opts), { mock: false });
}

function buildUrl(path, params) {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== null && v !== undefined && v !== "") p.set(k, String(v));
  }
  const qs = p.toString();
  return `${API_URL}${path}${qs ? `?${qs}` : ""}`;
}

async function request(path, params, { onProgress, signal, poll = false } = {}) {
  const url = buildUrl(path, params);
  let retries = 0;
  for (;;) {
    const res = await fetch(url, { signal });
    const body = await res.json().catch(() => ({}));

    if (res.status === 202 && poll) {
      onProgress?.(body);
      await sleep(POLL_MS, signal);
      continue;
    }
    if ((res.status === 429 || res.status === 503) && retries < MAX_RETRIES) {
      retries += 1;
      onProgress?.({ status: "retrying", attempt: retries, httpStatus: res.status });
      await sleep(POLL_MS * 2 ** (retries - 1), signal); // 2, 4, 8, 16 s
      continue;
    }
    if (!res.ok) throw new ApiError(body.detail || `HTTP ${res.status}`, res.status);
    return body;
  }
}

// Backend image URLs are relative ("/img/abc.png"): make them absolute so they work from Vercel.
// Mock URLs point at frontend/public/mock/ and stay relative to the frontend.
function withImageUrls(body, { mock }) {
  if (mock) return structuredClone(body);
  const abs = (u) => (u && u.startsWith("/") ? API_URL + u : u);
  if (Array.isArray(body.frames)) {
    return { ...body, frames: body.frames.map((f) => ({ ...f, url: abs(f.url) })) };
  }
  return { ...body, url: abs(body.url) };
}

// Mock: short delay, and a fake queued → processing phase for polling endpoints.
async function fakeCall(mock, { onProgress, signal, poll = false } = {}) {
  if (poll) {
    onProgress?.({ status: "queued", position: 1 });
    await sleep(300, signal);
    for (let done = 1; done <= 3; done++) {
      onProgress?.({ status: "processing", done, total: 3 });
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
