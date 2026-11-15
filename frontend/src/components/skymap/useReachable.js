import { useEffect, useState } from "react";

const DEFAULT_TIMEOUT_MS = 15_000; // CDS can take several seconds to answer

/**
 * Checks once whether `url` answers at all: "checking" → "ok" | "unreachable".
 *
 * Aladin Lite fetches its sky tiles in the background and logs errors nothing can catch when the
 * CDS servers are down, so this tells the sky map whether to blame the network in its message.
 * It never stops the map from loading: it is a hint, not a gate.
 *
 * Only a network-level failure (no connection, DNS, timeout) counts as unreachable. An HTTP error
 * such as 404 proves a server answered, and the request is sent with `no-cors` so a missing CORS
 * header cannot look like an outage either. Both would otherwise report a false alarm.
 */
export function useReachable(url, timeoutMs = DEFAULT_TIMEOUT_MS) {
  const [state, setState] = useState("checking");

  useEffect(() => {
    const controller = new AbortController();
    const signal = AbortSignal.any([controller.signal, AbortSignal.timeout(timeoutMs)]);
    setState("checking");
    fetch(url, { signal, mode: "no-cors", cache: "no-store" })
      .then(() => setState("ok")) // any answer at all, even an opaque one
      .catch(() => {
        if (!controller.signal.aborted) setState("unreachable");
      });
    return () => controller.abort();
  }, [url, timeoutMs]);

  return state;
}
