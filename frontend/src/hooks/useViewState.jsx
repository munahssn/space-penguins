// Shared view state, synced to the URL so every view is a shareable link.
//
//   const { ra, dec, fov, det, mode, display, stretch, wmin, wmax, selected, embed, setView, setRa, ..., shareUrl } = useViewState();
//
// - Wrap the app in <ViewStateProvider> once (done in main.jsx).
// - URL keys: ?ra&dec&fov&det&mode&display&stretch&wmin&wmax&embed=1
// - Values outside the allowed ones (e.g. det=D9, fov=5) fall back to the default.
// - `selected` (the clicked {ra, dec}) is NOT put in the URL.
// - `embed` is read from the URL only (?embed=1). Components hide chrome when it's true.
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

export const DEFAULTS = {
  ra: null,          // degrees, null = nothing chosen yet
  dec: null,         // degrees
  fov: 0.1,          // degrees, max 0.5
  det: "D3",         // "D1".."D6" or "all"
  mode: "epoch",     // which data: "epoch" (stack per survey pass) | "exposure" (every exposure)
  display: "blink",  // what the player shows: "blink" | "diff" | "rgb"
  stretch: "normal", // brightness, applied in the browser: "normal" | "faint" | "contrast"
  wmin: null,        // µm, null = no wavelength filter
  wmax: null,        // µm
  selected: null,    // { ra, dec, mjd, date } of the clicked spot and the frame it was clicked on, or null
  embed: false,      // true when the page is loaded with ?embed=1
};

// Allowed values per string key, and valid range per number key.
const CHOICES = {
  det: ["D1", "D2", "D3", "D4", "D5", "D6", "all"],
  mode: ["epoch", "exposure"],
  display: ["blink", "diff", "rgb"],
  stretch: ["normal", "faint", "contrast"],
};
const RANGES = {
  ra: [0, 360],
  dec: [-90, 90],
  fov: [0.005, 0.5],
  wmin: [0.75, 5.0],
  wmax: [0.75, 5.0],
};
const NUMBER_KEYS = Object.keys(RANGES);
const STRING_KEYS = Object.keys(CHOICES);
const URL_KEYS = [...NUMBER_KEYS, ...STRING_KEYS];

function inRange(key, value) {
  const [min, max] = RANGES[key];
  return Number.isFinite(value) && value >= min && value <= max;
}

function readUrl() {
  const p = new URLSearchParams(window.location.search);
  const state = { ...DEFAULTS };
  for (const k of NUMBER_KEYS) {
    if (p.has(k) && p.get(k) !== "") {
      const v = Number(p.get(k));
      if (inRange(k, v)) state[k] = v;
    }
  }
  for (const k of STRING_KEYS) {
    if (CHOICES[k].includes(p.get(k))) state[k] = p.get(k);
  }
  state.embed = p.get("embed") === "1";
  return state;
}

/** Puts the view keys of `state` into `params`. Defaults are left out so links stay short. */
function setViewParams(params, state) {
  for (const k of URL_KEYS) {
    const v = state[k];
    if (v === null || v === undefined || v === DEFAULTS[k]) params.delete(k);
    else params.set(k, String(v));
  }
}

function withQuery(base, params) {
  const qs = params.toString();
  return base + (qs ? `?${qs}` : "");
}

/** Keeps the address bar in sync. Other params already there (e.g. embed, dev) are kept. */
function writeUrl(state) {
  const params = new URLSearchParams(window.location.search);
  setViewParams(params, state);
  window.history.replaceState(null, "", withQuery(window.location.pathname, params) + window.location.hash);
}

/**
 * Full link that reopens this view: only the view keys, nothing else from the current URL.
 * buildShareUrl(state, { embed: true }) gives the iframe version (#14).
 */
export function buildShareUrl(state, { embed = false } = {}) {
  const params = new URLSearchParams();
  setViewParams(params, state);
  if (embed) params.set("embed", "1");
  return withQuery(window.location.origin + window.location.pathname, params);
}

const ViewStateContext = createContext(null);

export function ViewStateProvider({ children }) {
  const [state, setState] = useState(readUrl);

  useEffect(() => { writeUrl(state); }, [state]);

  // Back/forward or a pasted link in the same tab.
  useEffect(() => {
    const onPop = () => setState((s) => ({ ...readUrl(), selected: s.selected }));
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  // setView({ ra, dec }) updates several fields at once (one URL write, one render).
  const setView = useCallback((patch) => {
    setState((s) => {
      const p = typeof patch === "function" ? patch(s) : patch;
      const next = { ...s, ...p };
      // A new position clears the clicked source.
      if (("ra" in p || "dec" in p) && !("selected" in p)) next.selected = null;
      return next;
    });
  }, []);

  const value = useMemo(() => ({
    ...state,
    setView,
    setRa: (ra) => setView({ ra }),
    setDec: (dec) => setView({ dec }),
    setFov: (fov) => setView({ fov }),
    setDet: (det) => setView({ det }),
    setMode: (mode) => setView({ mode }),
    setDisplay: (display) => setView({ display }),
    setStretch: (stretch) => setView({ stretch }),
    setWmin: (wmin) => setView({ wmin }),
    setWmax: (wmax) => setView({ wmax }),
    setSelected: (selected) => setView({ selected }),
    shareUrl: (options) => buildShareUrl(state, options),
    reset: () => setState({ ...DEFAULTS, embed: state.embed }),
  }), [state, setView]);

  return <ViewStateContext.Provider value={value}>{children}</ViewStateContext.Provider>;
}

export function useViewState() {
  const ctx = useContext(ViewStateContext);
  if (!ctx) throw new Error("useViewState() must be used inside <ViewStateProvider>");
  return ctx;
}
