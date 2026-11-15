import { useEffect, useState } from "react";
import { subscribeActivity } from "../api/api.js";

/**
 * The latest progress update of the newest request still in flight, or null when nothing is waiting.
 * e.g. { status: "processing", done: 40, total: 120 } or { status: "retrying", httpStatus: 503, retryInMs: 4000 }
 */
export function useApiActivity() {
  const [inFlight, setInFlight] = useState({}); // request id → latest update

  useEffect(
    () =>
      subscribeActivity(({ id, ...update }) => {
        setInFlight((prev) => {
          if (update.status === "settled" && !(id in prev)) return prev; // never reported progress
          const next = { ...prev };
          if (update.status === "settled") delete next[id];
          else next[id] = update;
          return next;
        });
      }),
    [],
  );

  const ids = Object.keys(inFlight).map(Number);
  return ids.length > 0 ? inFlight[Math.max(...ids)] : null;
}
