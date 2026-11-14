// Fetches the single image behind the Difference or IR colour view. Cancels when the view changes.
import { useEffect, useState } from "react";
import { getDiff, getRgb } from "../../api/api.js";

const IDLE = { url: null, progress: null, error: null, loading: false };

/**
 * Difference = last pass − first pass (backend default for b), so it needs the same data params as the frames.
 * IR colour always combines D1/D3/D6, so detector, mode and wavelength don't matter for it.
 */
const REQUESTS = {
  diff: ({ ra, dec, fov, det, mode, wmin, wmax }, opts) =>
    getDiff({ ra, dec, fov, det, mode, wmin, wmax, a: 0, op: "sub" }, opts),
  rgb: ({ ra, dec, fov }, opts) => getRgb({ ra, dec, fov }, opts),
};

/**
 * @param {"diff"|"rgb"} kind
 * @param {object} view  fields from useViewState
 * @returns {{url: string|null, progress: object|null, error: Error|null, loading: boolean}}
 */
export function useStillImage(kind, { ra, dec, fov, det, mode, wmin, wmax }) {
  const [result, setResult] = useState(IDLE);

  useEffect(() => {
    const request = REQUESTS[kind];
    if (!request || ra === null || dec === null) {
      setResult(IDLE);
      return undefined;
    }

    const controller = new AbortController();
    setResult({ ...IDLE, loading: true });

    request(
      { ra, dec, fov, det, mode, wmin, wmax },
      {
        signal: controller.signal,
        onProgress: (progress) => setResult((current) => ({ ...current, progress })),
      },
    )
      .then(({ url }) => setResult({ ...IDLE, url }))
      .catch((error) => {
        if (!controller.signal.aborted) setResult({ ...IDLE, error });
      });

    return () => controller.abort();
  }, [kind, ra, dec, fov, det, mode, wmin, wmax]);

  return result;
}
