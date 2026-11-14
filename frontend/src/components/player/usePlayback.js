// Which frame is showing, whether it's playing, and how fast.
import { useCallback, useEffect, useState } from "react";
import { DEFAULT_SPEED, SPEEDS } from "./constants.js";

/** Wraps any integer into 0..count-1 (so -1 → last frame). */
function wrap(i, count) {
  return ((i % count) + count) % count;
}

/**
 * @param {number} frameCount
 * @param {unknown} resetKey  playback restarts from frame 0 whenever this changes (pass the frames array)
 */
export function usePlayback(frameCount, resetKey) {
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [speed, setSpeed] = useState(DEFAULT_SPEED);

  useEffect(() => {
    setIndex(0);
    setPlaying(true);
  }, [resetKey]);

  useEffect(() => {
    if (!playing || frameCount < 2) return undefined;
    const timer = setInterval(() => setIndex((i) => wrap(i + 1, frameCount)), SPEEDS[speed]);
    return () => clearInterval(timer);
  }, [playing, speed, frameCount]);

  /** Show a specific frame and pause, so the user can look at it. */
  const goTo = useCallback((target) => {
    if (frameCount === 0) return;
    setPlaying(false);
    setIndex(wrap(target, frameCount));
  }, [frameCount]);

  /** Step forward (+1) or back (-1) and pause. */
  const step = useCallback((delta) => {
    if (frameCount === 0) return;
    setPlaying(false);
    setIndex((i) => wrap(i + delta, frameCount));
  }, [frameCount]);

  const togglePlaying = useCallback(() => setPlaying((p) => !p), []);

  // Guards against a stale index for one render when the frame list shrinks.
  const safeIndex = frameCount === 0 ? 0 : Math.min(index, frameCount - 1);

  return { index: safeIndex, playing, speed, setSpeed, togglePlaying, goTo, step };
}
