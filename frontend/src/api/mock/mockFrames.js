// Mock /api/frames that reacts to the wavelength filter, so the slider shows believable counts offline.
// Pretends each pass's exposures are spread evenly over the detector's wavelength range.
import { ApiError } from "../errors.js";
import { detectorRange } from "../spherex.js";
import framesJson from "./frames.json";

export function mockFrames({ det, wmin, wmax }) {
  const body = structuredClone(framesJson);
  if (wmin == null && wmax == null) return body;

  const [lo, hi] = detectorRange(det);
  const from = Math.max(wmin ?? lo, lo);
  const to = Math.min(wmax ?? hi, hi);
  const share = Math.max(0, to - from) / (hi - lo);

  body.frames = body.frames
    .map((f) => ({ ...f, n_exposures: Math.round(f.n_exposures_total * share) }))
    .filter((f) => f.n_exposures > 0);
  if (body.frames.length === 0) throw new ApiError(`No exposures between ${wmin} and ${wmax} µm`, 404);
  return body;
}
