// Fetches the single image behind the Difference or IR colour view. Cancels when the view changes.
import { getDiff, getRgb } from "../../api/api.js";
import { useRequest } from "../../hooks/useRequest.js";

/**
 * Which view parameters each image depends on, and how to ask for it.
 * Difference = last pass − first pass (backend default for b), so it needs the same data params as the frames.
 * IR colour always combines D1/D3/D6, so detector, mode and wavelength don't matter for it.
 */
const REQUESTS = {
  diff: {
    params: ({ ra, dec, fov, det, mode, wmin, wmax }) => ({ ra, dec, fov, det, mode, wmin, wmax }),
    fetch: (params, opts) => getDiff({ ...params, a: 0, op: "sub" }, opts),
  },
  rgb: {
    params: ({ ra, dec, fov }) => ({ ra, dec, fov }),
    fetch: getRgb,
  },
};

/**
 * @param {"diff"|"rgb"} kind
 * @param {object} view  fields from useViewState
 * @returns {{url: string|null, progress: object|null, error: Error|null, loading: boolean}}
 */
export function useStillImage(kind, view) {
  const request = REQUESTS[kind];
  const params = request?.params(view);
  const key = !request || view.ra === null || view.dec === null ? null : JSON.stringify([kind, params]);
  const { data, progress, error, loading } = useRequest(key, (signal, onProgress) =>
    request.fetch(params, { signal, onProgress }));

  return { url: data?.url ?? null, progress, error, loading };
}
