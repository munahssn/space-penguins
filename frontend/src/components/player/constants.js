// Tunable numbers and labels for the frame player, in one place.

/** What the player can show. `id` matches `display` in useViewState. */
export const DISPLAYS = [
  { id: "blink", label: "Blink" },
  { id: "diff", label: "Difference" },
  { id: "rgb", label: "IR colour" },
];

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

/** IR colour image: which detector feeds which channel (matches the backend's /api/rgb). */
export const RGB_CHANNELS = [
  { channel: "Red", det: "D6", range: "4.4–5.0 µm" },
  { channel: "Green", det: "D3", range: "1.6–2.4 µm" },
  { channel: "Blue", det: "D1", range: "0.75–1.1 µm" },
];

/** Overlays drawn on the image, in the order of their toggles. */
export const OVERLAYS = [
  { id: "stars", label: "Gaia stars" },
  { id: "asteroids", label: "Known asteroids" },
  { id: "flags", label: "Flagged pixels" },
];
export const DEFAULT_OVERLAYS = { stars: true, asteroids: true, flags: false };

/** Marker sizes in image pixels (1 px ≈ 6″), so they scale with the image. */
export const MARKER_SIZES = {
  starRing: 1.6,      // radius of a Gaia circle
  asteroidDot: 0.7,   // radius of an asteroid dot
  selectedRing: 2.6,  // radius of the selection ring
};
