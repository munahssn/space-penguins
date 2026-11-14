// Draws one frame image on a canvas, pixel for pixel. CSS scales it up with sharp (pixelated) edges,
// so each SPHEREx pixel stays a visible square instead of a blur.
import { useEffect, useRef } from "react";

/**
 * @param {{image: HTMLImageElement|null, width: number, height: number, label: string, children?: React.ReactNode}} props
 *   width/height: the frame grid in pixels (same for every frame). children are drawn on top (scale bar etc.).
 */
export default function FrameCanvas({ image, width, height, label, children }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, width, height);
    if (!image) return;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(image, 0, 0, width, height);
  }, [image, width, height]);

  return (
    <div className="fp-stage">
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        className="fp-canvas"
        role="img"
        aria-label={label}
      />
      {children}
    </div>
  );
}
