// Is the backend awake? Checked once on page load, shared by the data chip and the status bar.
//
//   const { state, health } = useServerStatus();
//   state: "checking" → "ok"
//                     → "waking"       (no answer within 3 s: a sleeping Hugging Face Space takes ~1 min)
//                     → "unreachable"  (still nothing after 2 min; we keep trying anyway)
import { createContext, useContext, useEffect, useState } from "react";
import { getHealth } from "../api/api.js";

const WAKING_AFTER_MS = 3_000;
const ATTEMPT_TIMEOUT_MS = 20_000; // a hung request is dropped and retried
const RETRY_EVERY_MS = 5_000;
const UNREACHABLE_AFTER_MS = 120_000;

const ServerStatusContext = createContext(null);

export function ServerStatusProvider({ children }) {
  const [status, setStatus] = useState({ state: "checking", health: null });

  useEffect(() => {
    const controller = new AbortController();
    const startedAt = Date.now();
    const stillWaiting = () => (Date.now() - startedAt > UNREACHABLE_AFTER_MS ? "unreachable" : "waking");

    const wakingTimer = setTimeout(
      () => setStatus((s) => (s.state === "checking" ? { ...s, state: "waking" } : s)),
      WAKING_AFTER_MS,
    );

    async function checkUntilAwake() {
      while (!controller.signal.aborted) {
        try {
          const signal = AbortSignal.any([controller.signal, AbortSignal.timeout(ATTEMPT_TIMEOUT_MS)]);
          const health = await getHealth({ signal });
          setStatus({ state: "ok", health });
          return;
        } catch {
          if (controller.signal.aborted) return;
          setStatus({ state: stillWaiting(), health: null });
          await new Promise((resolve) => setTimeout(resolve, RETRY_EVERY_MS));
        }
      }
    }

    checkUntilAwake().finally(() => clearTimeout(wakingTimer));
    return () => {
      controller.abort();
      clearTimeout(wakingTimer);
    };
  }, []);

  return <ServerStatusContext.Provider value={status}>{children}</ServerStatusContext.Provider>;
}

export function useServerStatus() {
  const ctx = useContext(ServerStatusContext);
  if (!ctx) throw new Error("useServerStatus() must be used inside <ServerStatusProvider>");
  return ctx;
}
