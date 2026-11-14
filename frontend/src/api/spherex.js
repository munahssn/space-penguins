// SPHEREx instrument facts shared by the UI (ControlPanel) and the mock data.

export const WAVELENGTH_RANGE_UM = [0.75, 5.0];

/** The six detector arrays and the wavelengths each one sees (µm). */
export const DETECTORS = [
  { value: "D1", minUm: 0.75, maxUm: 1.11 },
  { value: "D2", minUm: 1.11, maxUm: 1.64 },
  { value: "D3", minUm: 1.64, maxUm: 2.42 },
  { value: "D4", minUm: 2.42, maxUm: 3.82 },
  { value: "D5", minUm: 3.82, maxUm: 4.42 },
  { value: "D6", minUm: 4.42, maxUm: 5.0 },
];

/** [min, max] µm for a detector ("D1".."D6"), or the full range for "all". */
export function detectorRange(det) {
  const detector = DETECTORS.find((d) => d.value === det);
  return detector ? [detector.minUm, detector.maxUm] : WAVELENGTH_RANGE_UM;
}
