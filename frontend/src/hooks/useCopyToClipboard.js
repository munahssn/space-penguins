import { useCallback, useEffect, useRef, useState } from "react";

const RESET_MS = 1500;

/** const [copied, copy] = useCopyToClipboard();  copy(text) → copied is true for 1.5 s. */
export function useCopyToClipboard() {
  const [copied, setCopied] = useState(false);
  const timer = useRef(null);

  useEffect(() => () => clearTimeout(timer.current), []);

  const copy = useCallback(async (text) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      return false; // clipboard blocked (http, permissions): caller can fall back
    }
    setCopied(true);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopied(false), RESET_MS);
    return true;
  }, []);

  return [copied, copy];
}
