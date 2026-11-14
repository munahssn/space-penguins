// Runs one API request whenever `key` changes, cancels the previous one, and tracks its state.
//
//   const { data, error, loading } = useRequest(key, (signal) => getTrack({ ra, dec }, { signal }));
//
// key: anything that identifies the request (a string is easiest); null = don't request.
import { useEffect, useRef, useState } from "react";

const IDLE = { data: null, error: null, loading: false };

export function useRequest(key, request) {
  const [state, setState] = useState(IDLE);
  const latestRequest = useRef(request);
  latestRequest.current = request; // always call the newest closure, but only re-run when key changes

  useEffect(() => {
    if (key === null) {
      setState(IDLE);
      return undefined;
    }
    const controller = new AbortController();
    setState({ ...IDLE, loading: true });
    latestRequest.current(controller.signal)
      .then((data) => setState({ ...IDLE, data }))
      .catch((error) => {
        if (!controller.signal.aborted) setState({ ...IDLE, error });
      });
    return () => controller.abort();
  }, [key]);

  return state;
}
