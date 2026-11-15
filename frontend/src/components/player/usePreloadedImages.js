// Downloads every frame image up front, so blinking never waits on the network.
import { useEffect, useState } from "react";

const EMPTY = { images: [], loaded: 0, failed: 0 };

/**
 * @param {string[]} urls
 * @returns {{images:(HTMLImageElement|null)[], loaded:number, failed:number, ready:boolean}}
 *   `images[i]` is null until url i has loaded (or if it failed).
 */
export function usePreloadedImages(urls) {
  const [state, setState] = useState(EMPTY);
  const urlKey = urls.join("\n"); // effect re-runs only when the actual list changes

  useEffect(() => {
    let cancelled = false;
    const images = urls.map(() => null);
    setState({ ...EMPTY, images });

    urls.forEach((url, i) => {
      const img = new Image();
      img.onload = () => {
        if (cancelled) return;
        images[i] = img;
        setState((s) => ({ ...s, images: [...images], loaded: s.loaded + 1 }));
      };
      img.onerror = () => {
        if (!cancelled) setState((s) => ({ ...s, failed: s.failed + 1 }));
      };
      img.src = url;
    });

    return () => {
      cancelled = true;
    };
    // urls is represented by urlKey; a new array with the same urls must not restart loading.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlKey]);

  const ready = urls.length > 0 && state.loaded + state.failed === urls.length;
  return { ...state, ready };
}
