// Loads the frame list for the current view. Re-fetches when the view changes and cancels the old request.
import { useEffect, useState } from "react";
import { getFrames } from "../../api/api.js";

const IDLE = { frames: [], grid: null, progress: null, error: null, loading: false };

/**
 * @param {{ra:number|null, dec:number|null, fov:number, det:string, mode:string, wmin:number|null, wmax:number|null}} view
 * @returns {{frames:object[], grid:object|null, progress:object|null, error:Error|null, loading:boolean}}
 */
export function useFrames({ ra, dec, fov, det, mode, wmin, wmax }) {
  const [result, setResult] = useState(IDLE);

  useEffect(() => {
    if (ra === null || dec === null) {
      setResult(IDLE);
      return undefined;
    }

    const controller = new AbortController();
    setResult({ ...IDLE, loading: true });

    getFrames(
      { ra, dec, fov, det, mode, wmin, wmax },
      {
        signal: controller.signal,
        onProgress: (progress) => setResult((current) => ({ ...current, progress })),
      },
    )
      .then(({ frames, grid }) => setResult({ ...IDLE, frames, grid }))
      .catch((error) => {
        if (!controller.signal.aborted) setResult({ ...IDLE, error });
      });

    return () => controller.abort();
  }, [ra, dec, fov, det, mode, wmin, wmax]);

  return result;
}
