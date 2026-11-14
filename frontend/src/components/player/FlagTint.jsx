// Yellow tint over flagged (masked) pixels. The backend sends a mask image per frame (`flags_url`):
// opaque where a pixel was flagged, transparent elsewhere. We paint yellow through that mask on a
// canvas, so the tint keeps the same hard pixel edges as the image.
import { useEffect, useRef } from "react";

/** @param {{mask: HTMLImageElement|null, width: number, height: number}} props */
export default function FlagTint({ mask, width, height }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, width, height);
    if (!mask) return;
    ctx.imageSmoothingEnabled = false;
    ctx.globalCompositeOperation = "source-over";
    ctx.drawImage(mask, 0, 0, width, height);
    ctx.globalCompositeOperation = "source-in"; // keep the mask's shape, replace its colour
    ctx.fillStyle = getComputedStyle(canvasRef.current).color; // --fp-flag, set in CSS
    ctx.fillRect(0, 0, width, height);
  }, [mask, width, height]);

  return <canvas ref={canvasRef} width={width} height={height} className="fp-layer fp-flag-tint" aria-hidden="true" />;
}
