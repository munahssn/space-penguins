/**
 * Clears `canvas` and draws `image` over the whole of it with hard pixel edges (no smoothing).
 * Returns the 2D context for more drawing on top, or null when there's no canvas or no image.
 */
export function drawSharp(canvas, image, width, height) {
  const ctx = canvas?.getContext("2d");
  if (!ctx) return null;
  ctx.clearRect(0, 0, width, height);
  if (!image) return null;
  ctx.imageSmoothingEnabled = false;
  ctx.globalCompositeOperation = "source-over";
  ctx.drawImage(image, 0, 0, width, height);
  return ctx;
}
