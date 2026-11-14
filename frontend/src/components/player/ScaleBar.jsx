// Scale bar + orientation, drawn over the frame. Sized in % of the frame, so it scales with the canvas.
import { MAX_SCALE_BAR_SHARE, SCALE_BAR_ARCSEC } from "./constants.js";

/** "30″", "1′", "2.5′" */
export function formatArcsec(arcsec) {
  if (arcsec < 60) return `${arcsec}″`;
  const arcmin = arcsec / 60;
  return `${Number.isInteger(arcmin) ? arcmin : arcmin.toFixed(1)}′`;
}

/** Longest candidate length that fits in MAX_SCALE_BAR_SHARE of the field (or the shortest one if none fit). */
export function pickScaleBar(fieldArcsec) {
  const fitting = SCALE_BAR_ARCSEC.filter((len) => len <= fieldArcsec * MAX_SCALE_BAR_SHARE);
  return fitting.length ? fitting[fitting.length - 1] : SCALE_BAR_ARCSEC[0];
}

/** @param {{grid: {width:number, pixscale_arcsec:number}}} props */
export default function ScaleBar({ grid }) {
  const fieldArcsec = grid.width * grid.pixscale_arcsec;
  const barArcsec = pickScaleBar(fieldArcsec);
  const widthPercent = (barArcsec / fieldArcsec) * 100;

  return (
    <div className="fp-scale">
      <span className="fp-scale-bar" style={{ width: `${widthPercent}%` }} aria-hidden="true" />
      <span>
        <span className="visually-hidden">Scale bar: </span>
        {formatArcsec(barArcsec)} · N up, E left
      </span>
    </div>
  );
}
