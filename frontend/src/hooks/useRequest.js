// Runs one API request whenever `key` changes, cancels the previous one, and tracks its state.
//
//   const { data, progress, error, loading } =
//     useRequest(key, (signal, onProgress) => getFrames(view, { signal, onProgress }));
//
// key: anything that identifies the request (a string is easiest); null = don't request.
// progress: the latest onProgress update from api.js (queued / processing / retrying), or null.
import { useEffect, useRef, useState } from "react";

const IDLE = { data: null, progress: null, error: null, loading: false };

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
    const onProgress = (progress) => {
      if (!controller.signal.aborted) setState((current) => ({ ...current, progress }));
    };
    setState({ ...IDLE, loading: true });
    latestRequest.current(controller.signal, onProgress)
      .then((data) => setState({ ...IDLE, data }))
      .catch((error) => {
        if (!controller.signal.aborted) setState({ ...IDLE, error });
      });
    return () => controller.abort();
  }, [key]);

  return state;
}
