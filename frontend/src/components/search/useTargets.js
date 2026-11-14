import { useEffect, useState } from "react";
import { getTargets } from "../../api/api.js";
import { useServerStatus } from "../../hooks/useServerStatus.jsx";

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
