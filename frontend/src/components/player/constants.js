// Tunable numbers for the frame player, in one place.

/** Milliseconds each frame stays on screen, per speed setting. */
export const SPEEDS = { slow: 1000, med: 600, fast: 300 };
export const SPEED_LABELS = { slow: "Slow", med: "Med", fast: "Fast" };
export const DEFAULT_SPEED = "med";

/** Above this share of artifact pixels (ghosts, halos, streaks…) a frame gets a warning. */
export const ARTIFACT_WARNING_FRACTION = 0.02;

/** With more frames than this, the epoch buttons turn into a slider. */
export const MAX_FRAME_BUTTONS = 8;

/** Scale bar: candidate lengths in arcseconds; the longest one up to MAX_SCALE_BAR_SHARE of the field wins. */
export const SCALE_BAR_ARCSEC = [10, 30, 60, 120, 300, 600, 1200];
export const MAX_SCALE_BAR_SHARE = 0.3;
