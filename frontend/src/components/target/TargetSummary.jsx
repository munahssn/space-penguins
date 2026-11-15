// Top of the side panel: what we're looking at and how much SPHEREx data there is for it.
import { useViewState } from "../../hooks/useViewState.jsx";
import { useFrames } from "../player/useFrames.js"; // same request as the player: api.js shares it
import { useCurrentTarget } from "../search/useTargets.js";
import { formatDeg, sentenceCase } from "./format.js";
import "./target.css";

const COORD_DECIMALS = 5;

/** Rows for the facts list. While frames load the counts show "…", after an error "—". */
function facts(view, { frames, loading }) {
  const pending = loading ? "…" : "—";
  const exposures = frames.reduce((n, f) => n + (f.n_exposures ?? 0), 0);
  return [
    ["RA", formatDeg(view.ra, { decimals: COORD_DECIMALS })],
    ["Dec", formatDeg(view.dec, { signed: true, decimals: COORD_DECIMALS })],
    [view.mode === "exposure" ? "Single exposures" : "Survey passes", frames.length || pending],
    ["Exposures used", exposures || pending],
    ["Newest image", frames.at(-1)?.date ?? pending],
  ];
}

export default function TargetSummary() {
  const view = useViewState();
  const target = useCurrentTarget();
  const frameResult = useFrames(view);

  return (
    <section className="side-block target-summary rise" aria-labelledby="target-summary-title">
      <h2 id="target-summary-title" className="kicker">{target ? "Test target" : "Target"}</h2>
      {target?.note && <p className="target-note">{sentenceCase(target.note)}</p>}
      <dl className="target-facts">
        {facts(view, frameResult).map(([label, value]) => (
          <div key={label} className="target-fact">
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
