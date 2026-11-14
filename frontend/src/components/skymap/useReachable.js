import { useEffect, useState } from "react";

const DEFAULT_TIMEOUT_MS = 8_000;

/**
 * Checks once whether `url` answers. "checking" → "ok" | "unreachable".
 *
 * Aladin Lite downloads its sky tiles in the background and throws uncaught errors when the CDS
 * servers can't be reached (offline, blocked network), which no try/catch around it can see.
 * Asking first lets the sky map show a clear message instead of starting a viewer that will fail.
 */
export function useReachable(url, timeoutMs = DEFAULT_TIMEOUT_MS) {
  const [state, setState] = useState("checking");

  useEffect(() => {
    const controller = new AbortController();
    const signal = AbortSignal.any([controller.signal, AbortSignal.timeout(timeoutMs)]);
    setState("checking");
    fetch(url, { signal, cache: "no-store" })
      .then((res) => setState(res.ok ? "ok" : "unreachable"))
      .catch(() => {
        if (!controller.signal.aborted) setState("unreachable");
      });
    return () => controller.abort();
  }, [url, timeoutMs]);

  return state;
}
