// How positions and notes are written across the target pieces.

const DEFAULT_DECIMALS = 4;
/** For exact positions in the side panel (≈0.04″). */
export const PRECISE_DECIMALS = 5;

/** 269.44630° (RA) or +4.76794° (Dec, always signed). */
function formatDeg(value, { signed = false, decimals = DEFAULT_DECIMALS } = {}) {
  const text = `${value.toFixed(decimals)}°`;
  return signed && value >= 0 ? `+${text}` : text;
}

/** "RA 269.4463° · Dec +4.7679°" */
export function formatPosition(ra, dec, decimals = DEFAULT_DECIMALS) {
  return `RA ${formatDeg(ra, { decimals })} · Dec ${formatDeg(dec, { signed: true, decimals })}`;
}

/** Backend notes start lower case ("variable young star"); shown on their own they need a capital. */
export function sentenceCase(text) {
  return text ? text[0].toUpperCase() + text.slice(1) : text;
}
