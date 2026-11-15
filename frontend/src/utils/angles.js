// Angle units and rounding shared by the player, charts, search and sky map.

export const ARCSEC_PER_DEG = 3600;
export const MAS_PER_ARCSEC = 1000;
export const RAD_PER_DEG = Math.PI / 180;

/** Any angle in degrees → 0..360 (RA wraps around). */
export function wrapDegrees(deg) {
  return ((deg % 360) + 360) % 360;
}

/** Positions are kept to 6 decimals (~0.004″), far finer than a 6″ SPHEREx pixel. */
export function roundDegrees(deg) {
  return Math.round(deg * 1e6) / 1e6;
}
