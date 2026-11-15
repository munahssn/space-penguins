// Choices shown in the ControlPanel. Values must match what useViewState allows.
import { DETECTORS, WAVELENGTH_RANGE_UM } from "../../api/spherex.js";

export const formatUm = (um) => um.toFixed(2);
const rangeLabel = ([min, max]) => `${formatUm(min)}–${formatUm(max)} µm`;

export const DETECTOR_OPTIONS = [
  ...DETECTORS.map((d) => ({ value: d.value, label: `${d.value} · ${rangeLabel([d.minUm, d.maxUm])}` })),
  { value: "all", label: `All bands · ${rangeLabel(WAVELENGTH_RANGE_UM)}` },
];

/** Field of view in degrees, labelled in arcminutes (backend max is 0.5°). */
export const FOV_OPTIONS = [0.05, 0.1, 0.2, 0.4, 0.5].map((deg) => ({ value: deg, label: arcminLabel(deg) }));

export function arcminLabel(deg) {
  return `${Number((deg * 60).toFixed(1))}′`;
}

export const STRETCH_OPTIONS = [
  { value: "normal", label: "Normal" },
  { value: "faint", label: "Show faint" },
  { value: "contrast", label: "High contrast" },
];
