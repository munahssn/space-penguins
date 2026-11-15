// Choices shown in the ControlPanel. useViewState accepts exactly these values from a URL.
import { DETECTORS, WAVELENGTH_RANGE_UM } from "../../api/spherex.js";

export const formatUm = (um) => um.toFixed(2);
/** [1.64, 2.42] → "1.64–2.42 µm" */
export const rangeLabel = ([min, max]) => `${formatUm(min)}–${formatUm(max)} µm`;

export const DETECTOR_OPTIONS = [
  ...DETECTORS.map((d) => ({ value: d.value, label: `${d.value} · ${rangeLabel([d.minUm, d.maxUm])}` })),
  { value: "all", label: `All bands · ${rangeLabel(WAVELENGTH_RANGE_UM)}` },
];

/** Field of view in degrees, labelled in arcminutes (backend max is 0.5°). */
export const FOV_OPTIONS = [0.05, 0.1, 0.2, 0.4, 0.5].map((deg) => ({ value: deg, label: arcminLabel(deg) }));

export function arcminLabel(deg) {
  return `${Number((deg * 60).toFixed(1))}′`;
}

/**
 * The options plus the current value if it isn't one of them (e.g. fov=0.15 from a shared link), so the
 * control can always show what's on. Option values may be numbers or strings.
 */
export function withCurrentValue(options, value, formatExtra = String) {
  return options.some((o) => o.value === value) ? options : [{ value, label: formatExtra(value) }, ...options];
}

export const STRETCH_OPTIONS = [
  { value: "normal", label: "Normal" },
  { value: "faint", label: "Show faint" },
  { value: "contrast", label: "High contrast" },
];
