import { useEffect, useState } from "react";
import { getHealth } from "../api/api.js";

/** Backend health, fetched once on mount. The status bar (#3) adds "waking up…" retries on top. */
export function useHealth() {
  const [state, setState] = useState({ health: null, error: null });

  useEffect(() => {
    const controller = new AbortController();
    getHealth({ signal: controller.signal })
      .then((health) => setState({ health, error: null }))
      .catch((error) => {
        if (error.name !== "AbortError") setState({ health: null, error });
      });
    return () => controller.abort();
  }, []);

  return state;
}
