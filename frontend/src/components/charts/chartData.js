// Turns API responses into chart rows. Plain functions, no React, so they're easy to test.

const MJD_UNIX_EPOCH = 40587; // MJD of 1970-01-01
const MS_PER_DAY = 86_400_000;
const DAYS_PER_YEAR = 365.25;
const ARCSEC_PER_DEG = 3600;
const MAS_PER_ARCSEC = 1000;

/** 60816.4 → "2025-05-21" */
export function mjdToDate(mjd) {
  return new Date((mjd - MJD_UNIX_EPOCH) * MS_PER_DAY).toISOString().slice(0, 10);
}

/** /api/spectrum points, sorted by wavelength (the order the eye reads a spectrum). */
export function spectrumRows(spectrum) {
  return [...(spectrum?.points ?? [])].sort((a, b) => a.wavelength_um - b.wavelength_um);
}

/** /api/lightcurve points, sorted by time, with a readable date. */
export function lightcurveRows(lightcurve) {
  return [...(lightcurve?.points ?? [])]
    .sort((a, b) => a.mjd - b.mjd)
    .map((p) => ({ ...p, date: mjdToDate(p.mjd) }));
}

/**
 * Motion track as offsets on the sky (arcseconds) from the first measured position.
 *   x = ΔRA·cos(Dec) (east positive), y = ΔDec (north positive)
 * `predicted` starts at the first measured point and moves with the catalog proper motion,
 * evaluated at the same dates, so each measured point has a predicted partner.
 *
 * @param {{measured: {mjd, ra, dec, err}[], catalog_pm: {pmra, pmdec}|null}} track
 *   ra/dec/err in degrees, pmra (already × cos Dec) / pmdec in mas/yr
 * @returns {{measured: object[], predicted: object[]}}
 */
export function trackRows(track) {
  const points = [...(track?.measured ?? [])].sort((a, b) => a.mjd - b.mjd);
  if (points.length === 0) return { measured: [], predicted: [] };

  const [first] = points;
  const cosDec = Math.cos((first.dec * Math.PI) / 180);

  const measured = points.map((p) => ({
    x: (p.ra - first.ra) * cosDec * ARCSEC_PER_DEG,
    y: (p.dec - first.dec) * ARCSEC_PER_DEG,
    err: (p.err ?? 0) * ARCSEC_PER_DEG,
    date: mjdToDate(p.mjd),
  }));

  const pm = track.catalog_pm;
  const predicted = pm
    ? points.map((p) => {
      const years = (p.mjd - first.mjd) / DAYS_PER_YEAR;
      return {
        x: (pm.pmra / MAS_PER_ARCSEC) * years,
        y: (pm.pmdec / MAS_PER_ARCSEC) * years,
        date: mjdToDate(p.mjd),
      };
    })
    : [];

  return { measured, predicted };
}
