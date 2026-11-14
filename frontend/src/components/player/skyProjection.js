// Sky (RA/Dec) ↔ image pixel conversion for the player's frames.
//
// Assumes the backend's frame grid (backend/app/spherex.py target_grid): a gnomonic (TAN) projection
// centred on the view's RA/Dec, north up, east left, square pixels of `grid.pixscale_arcsec`.
//
// Pixel coordinates here are "image" coordinates as drawn on the canvas: origin at the top-left
// corner, x to the right, y down, continuous (the first pixel spans 0..1, so its centre is 0.5).

const DEG = Math.PI / 180;

/** Reference pixel in FITS convention (1-based, pixel centres at integers): the image centre. */
const refPixel = (size) => (size + 1) / 2;

/**
 * @param {{ra:number, dec:number}} point   degrees
 * @param {{ra:number, dec:number}} center  degrees (the view's RA/Dec)
 * @param {{width:number, height:number, pixscale_arcsec:number}} grid
 * @returns {{x:number, y:number}|null}  null if the point is on the far side of the sky
 */
export function skyToPixel(point, center, grid) {
  const dRa = (point.ra - center.ra) * DEG;
  const dec = point.dec * DEG;
  const dec0 = center.dec * DEG;

  const cosC = Math.sin(dec0) * Math.sin(dec) + Math.cos(dec0) * Math.cos(dec) * Math.cos(dRa);
  if (cosC <= 0) return null;

  const xi = (Math.cos(dec) * Math.sin(dRa)) / cosC / DEG; // degrees, east positive
  const eta = (Math.cos(dec0) * Math.sin(dec) - Math.sin(dec0) * Math.cos(dec) * Math.cos(dRa)) / cosC / DEG;

  const scale = grid.pixscale_arcsec / 3600; // degrees per pixel
  const fitsX = refPixel(grid.width) - xi / scale; // east left
  const fitsY = refPixel(grid.height) + eta / scale; // north up in FITS
  return { x: fitsX - 0.5, y: grid.height - fitsY + 0.5 }; // FITS → canvas (y flipped)
}

/**
 * Inverse of skyToPixel.
 * @param {{x:number, y:number}} pixel  canvas pixel coordinates
 * @returns {{ra:number, dec:number}}  degrees, RA in 0..360
 */
export function pixelToSky(pixel, center, grid) {
  const scale = grid.pixscale_arcsec / 3600;
  const fitsX = pixel.x + 0.5;
  const fitsY = grid.height - pixel.y + 0.5;
  const xi = -(fitsX - refPixel(grid.width)) * scale * DEG;
  const eta = (fitsY - refPixel(grid.height)) * scale * DEG;

  const rho = Math.hypot(xi, eta);
  if (rho === 0) return { ra: center.ra, dec: center.dec };

  const c = Math.atan(rho);
  const dec0 = center.dec * DEG;
  const dec = Math.asin(Math.cos(c) * Math.sin(dec0) + (eta * Math.sin(c) * Math.cos(dec0)) / rho);
  const dRa = Math.atan2(xi * Math.sin(c), rho * Math.cos(dec0) * Math.cos(c) - eta * Math.sin(dec0) * Math.sin(c));

  return { ra: (((center.ra + dRa / DEG) % 360) + 360) % 360, dec: dec / DEG };
}

/** True if the pixel lies on the image (plus an optional margin in pixels). */
export function isOnImage(pixel, grid, margin = 0) {
  return Boolean(pixel)
    && pixel.x >= -margin && pixel.x <= grid.width + margin
    && pixel.y >= -margin && pixel.y <= grid.height + margin;
}

/** CSS position of an image pixel inside the player stage, in % (for absolutely positioned overlays). */
export function pixelToPercent({ x, y }, grid) {
  return { left: `${(x / grid.width) * 100}%`, top: `${(y / grid.height) * 100}%` };
}
