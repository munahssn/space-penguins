// Choices shown in the ControlPanel. Values must match what useViewState allows.

/** SPHEREx detector arrays and the wavelengths each one sees (µm). */
export const DETECTORS = [
  { value: "D1", minUm: 0.75, maxUm: 1.11 },
  { value: "D2", minUm: 1.11, maxUm: 1.64 },
  { value: "D3", minUm: 1.64, maxUm: 2.42 },
  { value: "D4", minUm: 2.42, maxUm: 3.82 },
  { value: "D5", minUm: 3.82, maxUm: 4.42 },
  { value: "D6", minUm: 4.42, maxUm: 5.0 },
];

export const DETECTOR_OPTIONS = [
  ...DETECTORS.map((d) => ({ value: d.value, label: `${d.value} · ${d.minUm.toFixed(2)}–${d.maxUm.toFixed(2)} µm` })),
  { value: "all", label: "All · 0.75–5.00 µm" },
];

/** Field of view in degrees, labelled in arcminutes (backend max is 0.5°). */
export const FOV_OPTIONS = [0.05, 0.1, 0.2, 0.4, 0.5].map((deg) => ({ value: deg, label: arcminLabel(deg) }));

export function arcminLabel(deg) {
  return `${Number((deg * 60).toFixed(1))}′`;
}

export const STRETCH_OPTIONS = [
  { value: "normal", label: "Normal" },
  { value: "faint", label: "Brighter (faint objects)" },
  { value: "contrast", label: "High contrast" },
];
