import { useEffect, useState } from "react";
import { getTargets } from "../../api/api.js";
import { useServerStatus } from "../../hooks/useServerStatus.jsx";
import { useViewState } from "../../hooks/useViewState.jsx";

const SAME_POSITION_DEG = 1e-4;

/** The test targets for the dropdown. Fetched once the server is awake; [] until then or on failure. */
export function useTargets() {
  const { state } = useServerStatus();
  const [targets, setTargets] = useState([]);

  useEffect(() => {
    if (state !== "ok") return undefined;
    const controller = new AbortController();
    getTargets({ signal: controller.signal })
      .then(setTargets)
      .catch(() => setTargets([])); // the dropdown just stays empty; search by name still works
    return () => controller.abort();
  }, [state]);

  return targets;
}

/** The test target at (ra, dec), if the view is centred on one. */
export function findTargetAt(targets, ra, dec) {
  if (ra === null || dec === null) return undefined;
  return targets.find((t) => Math.abs(t.ra - ra) < SAME_POSITION_DEG && Math.abs(t.dec - dec) < SAME_POSITION_DEG);
}

/** The test target the viewer is showing right now, or undefined for any other position. */
export function useCurrentTarget() {
  const { ra, dec } = useViewState();
  return findTargetAt(useTargets(), ra, dec);
}
