// Colours and shared axis styling for every chart.
//
// The two series colours were checked with the dataviz palette validator against the dark surface
// (#0f0f0f): both sit in the dark-mode lightness band, and they stay distinct for colour-blind
// readers (ΔE ≥ 23). Orange = what we measured (it matches the orange selection ring on the image);
// blue = what the catalog predicts (it matches the blue Gaia circles).
// Same values as --color-measured / --color-catalog in styles/theme.css (used by the verdict panel).
export const SERIES = {
  measured: "#e06c1f",
  predicted: "#2f94d6",
};

/** Text and grid use theme tokens, never the series colours. */
export const INK = {
  axis: "var(--color-text-muted)",
  grid: "var(--color-line)",
  reference: "var(--color-text-muted)",
};

/** Molecular ice bands SPHEREx was designed to look for (µm). */
export const ICE_LINES = [
  { wavelength: 3.0, label: "H₂O" },
  { wavelength: 4.27, label: "CO₂" },
  { wavelength: 4.67, label: "CO" },
];

/** SPHEREx covers 0.75–5.0 µm. */
export const WAVELENGTH_DOMAIN = [0.75, 5.0];
export const WAVELENGTH_TICKS = [1, 2, 3, 4, 5];

export const CHART_HEIGHT = 240;
export const CHART_MARGIN = { top: 20, right: 16, bottom: 24, left: 8 };
export const MARKER_RADIUS = 4; // ≥ 8 px markers

/** Props spread onto every XAxis / YAxis so all charts look the same. */
export const AXIS_PROPS = {
  stroke: INK.grid,
  tick: { fill: INK.axis, fontSize: 11 },
  tickLine: false,
};

export const AXIS_LABEL_STYLE = { fill: INK.axis, fontSize: 11 };
