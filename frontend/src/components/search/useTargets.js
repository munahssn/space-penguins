import { useEffect, useState } from "react";
import { getTargets } from "../../api/api.js";
import { useServerStatus } from "../../hooks/useServerStatus.jsx";
import { useViewState } from "../../hooks/useViewState.jsx";

const SAME_POSITION_DEG = 1e-4;

/**
 * The popular finds: the five objects from the challenge brief (backend ids from /api/targets) and what
 * each one is known for. The backend also lists a test spot, which isn't one of them.
 * The start page cards, the dropdown and the "Popular find" label all use this one list.
 */
export const POPULAR_FINDS = {
  barnard: "moves",
  "eps-indi-b": "moves",
  wise0855: "moves",
  "rw-aur": "brightness",
  "r-dra": "brightness",
};

/** The popular finds, in the backend's order. Fetched once the server is awake; [] until then or on failure. */
export function useTargets() {
  const { state } = useServerStatus();
  const [targets, setTargets] = useState([]);

  useEffect(() => {
    if (state !== "ok") return undefined;
    const controller = new AbortController();
    getTargets({ signal: controller.signal })
      .then((all) => setTargets(all.filter((t) => t.id in POPULAR_FINDS)))
      .catch(() => setTargets([])); // the dropdown just stays empty; search by name still works
    return () => controller.abort();
  }, [state]);

  return targets;
}

/** The popular find at (ra, dec), if the view is centred on one. */
function findTargetAt(targets, ra, dec) {
  if (ra === null || dec === null) return undefined;
  return targets.find((t) => Math.abs(t.ra - ra) < SAME_POSITION_DEG && Math.abs(t.dec - dec) < SAME_POSITION_DEG);
}

/** The popular find the viewer is showing right now, or undefined for any other position. */
export function useCurrentTarget() {
  const { ra, dec } = useViewState();
  return findTargetAt(useTargets(), ra, dec);
}
