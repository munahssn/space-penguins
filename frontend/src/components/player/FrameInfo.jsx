// Text under the player: which frame this is, and how much to trust it.
import { ARTIFACT_WARNING_FRACTION } from "./constants.js";

const percent = (fraction) => `${(fraction * 100).toFixed(1)}%`;

/** "Pass 2 of 3 · 2025-11-18" (epoch mode) or "Exposure 14 of 120 · 2025-11-18" */
export function frameLabel(frame, index, count, mode) {
  const unit = mode === "exposure" ? "Exposure" : "Pass";
  return `${unit} ${index + 1} of ${count} · ${frame.date}`;
}

/** "11 of 12 exposures · 2.0% bad pixels hidden" */
function qualityLine(frame) {
  const { n_exposures: used, n_exposures_total: total, flagged_fraction: flagged } = frame;
  const exposures = total && total !== used ? `${used} of ${total} exposures` : `${used} exposures`;
  return `${exposures} · ${percent(flagged ?? 0)} bad pixels hidden`;
}

/** @param {{frame: object, index: number, count: number, mode: string}} props */
export default function FrameInfo({ frame, index, count, mode }) {
  const artifacts = frame.artifact_fraction ?? 0;
  const warn = artifacts > ARTIFACT_WARNING_FRACTION;

  return (
    <div className="fp-info">
      <p className="fp-info-label">{frameLabel(frame, index, count, mode)}</p>
      <p className="fp-info-meta">{qualityLine(frame)}</p>
      {/*
        Always in the page, only hidden when there is nothing to warn about. Blinking steps through
        passes whose warnings come and go, and dropping the line would shift the charts and sky map
        up and down under the player. Keeping the same sentence reserves its real height, including
        the second line it wraps onto on a narrow screen.
      */}
      <p className="fp-info-warning" data-shown={warn} role={warn ? "note" : undefined} aria-hidden={!warn}>
        ⚠ {percent(artifacts)} of this frame is ghosts, halos or streaks. Check before trusting a mover.
      </p>
    </div>
  );
}
