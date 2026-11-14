// Shared view state, synced to the URL so every view is a shareable link.
//
//   const { ra, dec, fov, det, mode, wmin, wmax, selected, embed, setView, setRa, ... } = useViewState();
//
// - Wrap the app in <ViewStateProvider> once (done in main.jsx).
// - URL keys: ?ra&dec&fov&det&mode&wmin&wmax&embed=1
// - `selected` (the clicked {ra, dec}) is NOT put in the URL.
// - `embed` is read from the URL only (?embed=1). Components hide chrome when it's true.
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

export const DEFAULTS = {
  ra: null,          // degrees, null = nothing chosen yet
  dec: null,         // degrees
  fov: 0.1,          // degrees, max 0.5
  det: "D3",         // "D1".."D6" or "all"
  mode: "epoch",     // "epoch" | "exposure"
  wmin: null,        // µm, null = no wavelength filter
  wmax: null,        // µm
  selected: null,    // { ra, dec } of the clicked source, or null
  embed: false,      // true when the page is loaded with ?embed=1
};

const NUMBER_KEYS = ["ra", "dec", "fov", "wmin", "wmax"];
const STRING_KEYS = ["det", "mode"];
const URL_KEYS = [...NUMBER_KEYS, ...STRING_KEYS];

function readUrl() {
  const p = new URLSearchParams(window.location.search);
  const state = { ...DEFAULTS };
  for (const k of NUMBER_KEYS) {
    if (p.has(k) && p.get(k) !== "") {
      const v = Number(p.get(k));
      if (Number.isFinite(v)) state[k] = v;
    }
  }
  for (const k of STRING_KEYS) if (p.get(k)) state[k] = p.get(k);
  state.embed = p.get("embed") === "1";
  return state;
}

function writeUrl(state) {
  const p = new URLSearchParams(window.location.search);
  for (const k of URL_KEYS) {
    const v = state[k];
    // Leave defaults out so links stay short.
    if (v === null || v === undefined || v === DEFAULTS[k]) p.delete(k);
    else p.set(k, String(v));
  }
  const qs = p.toString();
  const url = window.location.pathname + (qs ? `?${qs}` : "") + window.location.hash;
  window.history.replaceState(null, "", url);
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
    setWmin: (wmin) => setView({ wmin }),
    setWmax: (wmax) => setView({ wmax }),
    setSelected: (selected) => setView({ selected }),
    reset: () => setState({ ...DEFAULTS, embed: state.embed }),
  }), [state, setView]);

  return <ViewStateContext.Provider value={value}>{children}</ViewStateContext.Provider>;
}

export function useViewState() {
  const ctx = useContext(ViewStateContext);
  if (!ctx) throw new Error("useViewState() must be used inside <ViewStateProvider>");
  return ctx;
}
