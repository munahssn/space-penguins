// Loads the frame list for the current view. Re-fetches when the view changes and cancels the old request.
import { getFrames } from "../../api/api.js";
import { useRequest } from "../../hooks/useRequest.js";

const NO_FRAMES = []; // one shared empty list, so components that depend on `frames` don't re-run for nothing

/**
 * @param {{ra:number|null, dec:number|null, fov:number, det:string, mode:string, wmin:number|null, wmax:number|null}} view
 * @returns {{frames:object[], grid:object|null, progress:object|null, error:Error|null, loading:boolean}}
 */
export function useFrames({ ra, dec, fov, det, mode, wmin, wmax }) {
  const params = { ra, dec, fov, det, mode, wmin, wmax };
  const key = ra === null || dec === null ? null : JSON.stringify(params);
  const { data, progress, error, loading } = useRequest(key, (signal, onProgress) =>
    getFrames(params, { signal, onProgress }));

  return { frames: data?.frames ?? NO_FRAMES, grid: data?.grid ?? null, progress, error, loading };
}
