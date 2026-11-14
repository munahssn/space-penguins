import { useEffect, useState } from "react";

/**
 * Creates one Aladin Lite viewer inside containerRef. The library (~2.4 MB) is loaded only when
 * this runs, so pages without a sky map stay light.
 * Returns { A, aladin, error }: A is the library (A.polygon, A.graphicOverlay, …), aladin the viewer.
 * `options` are read once, at creation.
 */
export function useAladin(containerRef, options) {
  const [state, setState] = useState({ A: null, aladin: null, error: null });

  useEffect(() => {
    let cancelled = false; // StrictMode mounts twice: only the surviving mount creates a viewer
    const container = containerRef.current;

    (async () => {
      try {
        const { default: A } = await import("aladin-lite");
        await A.init;
        if (cancelled) return;
        setState({ A, aladin: A.aladin(container, options), error: null });
      } catch (error) {
        if (!cancelled) setState({ A: null, aladin: null, error });
      }
    })();

    return () => {
      cancelled = true;
      container.replaceChildren(); // drop the viewer's DOM; Aladin has no public destroy()
    };
  }, [containerRef]); // options are creation-time only, so they are not a dependency

  return state;
}
