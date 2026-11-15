// Wavelength filter (#9, phase 4): only use exposures where the target fell between wmin and wmax.
// SPHEREx sees each spot at a different wavelength in every exposure, so a narrower range means
// fewer exposures per frame. The summary line says how many are left ("6 of 14 exposures used").
import { useCallback, useEffect, useId, useState } from "react";
import { detectorRange } from "../../api/spherex.js";
import { useViewState } from "../../hooks/useViewState.jsx";
import { useFrames } from "../player/useFrames.js"; // same request as the player: api.js shares it
import { formatUm } from "./options.js";

const STEP_UM = 0.01;
const MIN_SPAN_UM = 0.05;
const COMMIT_DELAY_MS = 400; // wait until the user stops dragging before asking for new frames

const round2 = (x) => Math.round(x * 100) / 100;
const sum = (frames, key) => frames.reduce((n, f) => n + (f[key] ?? 0), 0);

function exposureSummary({ frames, error, loading }) {
  if (error?.status === 404) return "No exposures in this range. Try a wider one.";
  if (error) return null; // the player shows the error
  if (loading || frames.length === 0) return "Counting exposures…";
  const used = sum(frames, "n_exposures");
  const total = sum(frames, "n_exposures_total") || used;
  return used === total ? `All ${total} exposures used` : `${used} of ${total} exposures used`;
}

/** Two-thumb slider. Keeps a local draft while dragging and calls onCommit(from, to) once it settles. */
function RangeSlider({ lo, hi, committedFrom, committedTo, onCommit, summary }) {
  const [[from, to], setRange] = useState([committedFrom, committedTo]);
  const labelId = useId();
  const filtered = from > lo || to < hi;
  const percent = (um) => `${((um - lo) / (hi - lo)) * 100}%`;

  // Follow changes made elsewhere (shared link, back button). After our own commit these already match.
  useEffect(() => {
    setRange([committedFrom, committedTo]);
  }, [committedFrom, committedTo]);

  useEffect(() => {
    if (from === committedFrom && to === committedTo) return undefined;
    const timer = setTimeout(() => onCommit(from, to), COMMIT_DELAY_MS);
    return () => clearTimeout(timer);
  }, [from, to, committedFrom, committedTo, onCommit]);

  return (
    <div className="wl" role="group" aria-labelledby={labelId}>
      <div className="wl-head">
        <span id={labelId} className="field-label">Narrow the band</span>
        <span className="wl-value">{formatUm(from)}–{formatUm(to)} µm</span>
        {filtered && (
          <button type="button" className="btn-ghost wl-reset" onClick={() => setRange([lo, hi])}>
            Reset
          </button>
        )}
      </div>
      <div className="wl-track" style={{ "--from": percent(from), "--to": percent(to) }}>
        <input
          type="range"
          min={lo}
          max={hi}
          step={STEP_UM}
          value={from}
          onChange={(e) => setRange([round2(Math.min(Number(e.target.value), to - MIN_SPAN_UM)), to])}
          aria-label="Shortest wavelength (µm)"
        />
        <input
          type="range"
          min={lo}
          max={hi}
          step={STEP_UM}
          value={to}
          onChange={(e) => setRange([from, round2(Math.max(Number(e.target.value), from + MIN_SPAN_UM))])}
          aria-label="Longest wavelength (µm)"
        />
      </div>
      <p className="wl-summary" aria-live="polite">{summary}</p>
    </div>
  );
}

export default function WavelengthSlider() {
  const view = useViewState();
  const { det, wmin, wmax, setView } = view;
  const [lo, hi] = detectorRange(det);
  const frames = useFrames(view);

  // The full detector range means "no filter", which keeps the URL short.
  const commit = useCallback(
    (from, to) => setView({ wmin: from > lo ? from : null, wmax: to < hi ? to : null }),
    [setView, lo, hi],
  );

  const committedFrom = wmin ?? lo;
  const committedTo = wmax ?? hi;
  return (
    <RangeSlider
      key={`${lo}-${hi}`} // new detector → fresh slider (keyed on range only, so a commit never interrupts a drag)
      lo={lo}
      hi={hi}
      committedFrom={committedFrom}
      committedTo={committedTo}
      onCommit={commit}
      summary={exposureSummary(frames)}
    />
  );
}
