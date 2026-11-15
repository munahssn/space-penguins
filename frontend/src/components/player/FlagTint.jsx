// Yellow tint over flagged (masked) pixels. The backend sends a mask image per frame (`flags_url`):
// opaque where a pixel was flagged, transparent elsewhere. We paint yellow through that mask on a
// canvas, so the tint keeps the same hard pixel edges as the image.
import { useEffect, useRef } from "react";
import { drawSharp } from "./drawSharp.js";

/** @param {{mask: HTMLImageElement|null, width: number, height: number}} props */
export default function FlagTint({ mask, width, height }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const ctx = drawSharp(canvasRef.current, mask, width, height);
    if (!ctx) return;
    ctx.globalCompositeOperation = "source-in"; // keep the mask's shape, replace its colour
    ctx.fillStyle = getComputedStyle(canvasRef.current).color; // --fp-flag, set in CSS
    ctx.fillRect(0, 0, width, height);
  }, [mask, width, height]);

  return <canvas ref={canvasRef} width={width} height={height} className="fp-layer fp-flag-tint" aria-hidden="true" />;
}
