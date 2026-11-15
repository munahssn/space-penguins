// Draws one frame image on a canvas, pixel for pixel. CSS scales it up with sharp (pixelated) edges,
// so each SPHEREx pixel stays a visible square instead of a blur.
import { useEffect, useRef } from "react";
import { drawSharp } from "./drawSharp.js";

/**
 * @param {{image: HTMLImageElement|null, width: number, height: number, label: string,
 *          stretch?: string, children?: React.ReactNode}} props
 *   width/height: the frame grid in pixels (same for every frame). children are drawn on top (scale bar etc.).
 *   stretch: display-only brightness boost ("normal" | "faint" | "contrast"), see FramePlayer.css.
 */
export default function FrameCanvas({ image, width, height, label, stretch = "normal", children }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    drawSharp(canvasRef.current, image, width, height);
  }, [image, width, height]);

  return (
    <div className="fp-stage">
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        className={`fp-canvas fp-canvas--${stretch}`}
        role="img"
        aria-label={label}
      />
      {children}
    </div>
  );
}
