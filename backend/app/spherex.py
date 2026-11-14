"""
SPHEREx data access: find images, download cutouts, stack per epoch, render PNGs.
Pure functions, no web code here, so it can be tested from a notebook.
"""
import base64
import concurrent.futures as cf
import io
import os
import re
import warnings

import numpy as np
from astropy.io import fits
from astropy.time import Time
from astropy.utils.data import conf
from astropy.visualization import ZScaleInterval
from astropy.wcs import WCS
from PIL import Image

conf.remote_timeout = 120

# SIA collections to search, in order of preference. DR1 and QR3 supersede QR2
# (IRSA recommends not using QR2). When a new release lands, add it at the front.
COLLECTIONS = os.environ.get("SPHEREX_COLLECTIONS", "spherex_dr1,spherex_qr3").split(",")
RELEASE = "+".join(c.replace("spherex_", "") for c in COLLECTIONS)
PIXSCALE_DEG = 6.15 / 3600
EPOCH_GAP_DAYS = 30  # a time gap bigger than this starts a new survey pass
# Wavelength range (um) of each detector's linear variable filter.
DET_RANGE_UM = {"D1": (0.75, 1.11), "D2": (1.11, 1.64), "D3": (1.64, 2.42),
                "D4": (2.42, 3.82), "D5": (3.82, 4.42), "D6": (4.42, 5.00)}

# FLAGS bits (from the FLAGS header, MSKNnnnn keywords / Explanatory Supplement Table 16).
# NB: bit 21 SOURCE is set on almost every pixel with a star on it, so never mask "flags != 0".
BAD_BITS = [0, 1, 2, 6, 7, 9, 10, 11, 15, 17, 19]
# TRANSIENT OVERFLOW SUR_ERROR NONFUNC DICHROIC MISSING HOT COLD NONLINEAR PERSIST OUTLIER
ARTIFACT_BITS = [20, 22, 23, 24, 25, 26, 27, 28]
# CROSSTALK GHOST GHOST_FPA GHOST_EXT STREAK BLOOM SNOWBALL HALO -> can fake a "mover", so we
# report them per frame (artifact_fraction) instead of hiding pixels.
BAD_MASK = sum(1 << b for b in BAD_BITS)
ARTIFACT_MASK = sum(1 << b for b in ARTIFACT_BITS)
_SIP_KEY = re.compile(r"^(A|B|AP|BP)_(ORDER|DMAX|\d+_\d+)$")


class NoData(Exception):
    pass


# ---------- query ----------

def find_images(ra, dec, fov, det):
    """Return list of dicts {uri, mjd, band} for images covering (ra, dec),
    as in IRSA's 'Introduction to SPHEREx Spectral Images' notebook (SIA query).
    Note: SIA lags new weekly data by ~1 day; fine for us."""
    import astropy.units as u
    from astropy.coordinates import SkyCoord
    from astroquery.ipac.irsa import Irsa

    coord = SkyCoord(ra, dec, unit="deg")
    tbl = Irsa.query_sia(pos=(coord, 1 * u.arcsec), collection=COLLECTIONS)

    rank = {c: i for i, c in enumerate(COLLECTIONS)}
    best = {}  # same exposure can be in DR1 and QR3: keep the preferred release
    for r in tbl:
        band = str(r["energy_bandpassname"])
        if det != "all" and band != f"SPHEREx-{det}":
            continue
        key = (str(r["obs_id"]), band)
        coll = str(r["obs_collection"]).lower()
        prio = rank.get(coll, len(rank))
        if key not in best or prio < best[key][0]:
            best[key] = (prio, {
                "uri": f"{r['access_url']}?center={ra},{dec}d&size={fov}",
                "mjd": float(r["t_min"]),
                "band": band,
            })
    return sorted((v[1] for v in best.values()), key=lambda x: x["mjd"])


# ---------- download + align ----------

def target_grid(ra, dec, fov):
    n = max(8, int(np.ceil(fov / PIXSCALE_DEG)))
    w = WCS(naxis=2)
    w.wcs.ctype = ["RA---TAN", "DEC--TAN"]
    w.wcs.crval = [ra, dec]
    w.wcs.crpix = [(n + 1) / 2, (n + 1) / 2]
    w.wcs.cdelt = [-PIXSCALE_DEG, PIXSCALE_DEG]
    return w, (n, n)


# Where pixels come from: "s3" = range reads from IRSA's public S3 bucket (fast, no cutout
# server), falling back to IRSA's cutout service if S3 fails. "irsa" = cutout service only.
SOURCE = os.environ.get("SPHEREX_SOURCE", "s3")
S3_PAD = 4  # extra detector pixels around the field, so reprojection has no empty edge


def _to_common_grid(img, var, flags, w_in, wcs_out, shape):
    """Mask bad pixels and reproject onto the target grid; measure the target.
    Returns (image, bad_fraction, artifact_fraction, phot); phot is measure_target's dict."""
    from reproject import reproject_interp

    bad = ((flags & BAD_MASK) != 0).astype(float)
    art = ((flags & ARTIFACT_MASK) != 0).astype(float)
    masked = img.copy()
    masked[bad > 0] = np.nan
    out, _ = reproject_interp((masked, w_in), wcs_out, shape_out=shape)
    # photometry needs the pixels under the target even when they are flagged (bright stars
    # saturate), so it uses the unmasked image; the flags it met are reported with the result
    raw, _ = reproject_interp((img, w_in), wcs_out, shape_out=shape)
    var_out, _ = reproject_interp((var.astype(float), w_in), wcs_out, shape_out=shape)
    phot = measure_target(raw, var_out, out, flags, w_in, wcs_out)
    # fractions measured on the original pixels (reprojection would blur single pixels)
    return out, float(bad.mean()), float(art.mean()), phot


def wavelength_at(hdul, w_sky, ra, dec):
    """Wavelength (um) the pixel under (ra, dec) saw in this exposure, or None.

    SPHEREx has a linear variable filter, so wavelength depends on where the
    target lands on the detector. It is stored as a lookup-table WCS (key "W",
    table in the WCS-WAVE extension). SIP distortion belongs to the sky WCS
    only and must not be applied here (IRSA cutout tutorial sets .sip = None);
    we drop the SIP keywords up front, which also keeps astropy quiet.
    """
    try:
        x, y = w_sky.all_world2pix(ra, dec, 0)
        hdr = hdul["IMAGE"].header.copy()
        for k in [k for k in hdr if _SIP_KEY.match(k)]:
            del hdr[k]
        with warnings.catch_warnings():
            warnings.simplefilter("ignore")
            w_spec = WCS(hdr, fobj=hdul, key="W")
            w_spec.sip = None
            wl, _bandwidth = w_spec.wcs_pix2world(x, y, 0)
        wl = float(wl)
        return wl if np.isfinite(wl) else None
    except Exception:
        return None


def _fetch_cutout_s3(uri, wcs_out, shape, ra, dec):
    """Read only the needed pixel box of IMAGE, ZODI and FLAGS from S3 (range requests)."""
    from astropy.coordinates import SkyCoord

    from .s3io import open_remote, s3_url_from_access_url

    hdul, _ = open_remote(s3_url_from_access_url(uri))
    try:
        hdr = hdul["IMAGE"].header
        w_in = WCS(hdr)  # primary = sky WCS (TAN-SIP)
        x, y = w_in.world_to_pixel(SkyCoord(ra, dec, unit="deg"))
        # native pixel is ~6.15", same as our grid, so half the grid size + padding
        half = int(np.ceil(max(shape) / 2)) + S3_PAD
        ny, nx = hdr["NAXIS2"], hdr["NAXIS1"]
        x0, x1 = max(int(round(float(x))) - half, 0), min(int(round(float(x))) + half + 1, nx)
        y0, y1 = max(int(round(float(y))) - half, 0), min(int(round(float(y))) + half + 1, ny)
        if x1 - x0 < 3 or y1 - y0 < 3:
            raise NoData("target is off this detector image")
        img = hdul["IMAGE"].section[y0:y1, x0:x1].astype(float) - hdul["ZODI"].section[y0:y1, x0:x1]
        flags = hdul["FLAGS"].section[y0:y1, x0:x1].astype(np.int64)
        var = hdul["VARIANCE"].section[y0:y1, x0:x1]
        wl = wavelength_at(hdul, w_in, ra, dec)  # full-frame WCS, before slicing
    finally:
        hdul.close()
    out, bad, art, phot = _to_common_grid(img, var, flags, w_in[y0:y1, x0:x1], wcs_out, shape)
    return out, bad, art, wl, phot


def _fetch_cutout_irsa(uri, wcs_out, shape, ra, dec):
    """Download one cutout from IRSA's cutout service (slower, sometimes 503 'busy')."""
    with fits.open(uri, memmap=False) as hdul:
        img = hdul["IMAGE"].data.astype(float) - hdul["ZODI"].data
        flags = hdul["FLAGS"].data.astype(np.int64)
        var = hdul["VARIANCE"].data
        w_in = WCS(hdul["IMAGE"].header)  # primary = sky WCS (TAN-SIP)
        wl = wavelength_at(hdul, w_in, ra, dec)
    out, bad, art, phot = _to_common_grid(img, var, flags, w_in, wcs_out, shape)
    return out, bad, art, wl, phot


def fetch_cutout(uri, wcs_out, shape, ra, dec):
    """Get one exposure's pixels around the target: subtract zodiacal light, mask bad pixels,
    put on the common grid. Returns (image, bad_fraction, artifact_fraction, wavelength_um,
    phot) or None. wavelength_um is the wavelength at the target position (None if
    unknown); phot is the target's brightness in this exposure (see measure_target).

    IMAGE is in MJy/sr with zodiacal light NOT subtracted, so we subtract ZODI.

    Tries S3 range reads first (2 tries), then IRSA's cutout service (3 tries, backoff).
    """
    import time

    plan = []
    if SOURCE == "s3":
        plan += [("s3", 1), ("s3", 2)]
    plan += [("irsa", 5), ("irsa", 10), ("irsa", 15)]

    err = None
    for source, wait in plan:
        try:
            fn = _fetch_cutout_s3 if source == "s3" else _fetch_cutout_irsa
            return fn(uri, wcs_out, shape, ra, dec)
        except NoData:
            return None  # target is not on this exposure's detector: no point retrying
        except Exception as e:  # network trouble, 503 busy, ...
            err = e
            time.sleep(wait)
    print(f"cutout failed: {uri} ({err})")
    return None


def group_epochs(mjds):
    groups, cur = [], [0]
    for i in range(1, len(mjds)):
        if mjds[i] - mjds[i - 1] > EPOCH_GAP_DAYS:
            groups.append(cur)
            cur = []
        cur.append(i)
    groups.append(cur)
    return groups


def in_range(wl, wmin, wmax):
    """True if an exposure at wavelength wl passes the wmin/wmax filter.
    With a filter set, exposures of unknown wavelength are left out."""
    if wmin is None and wmax is None:
        return True
    if wl is None:
        return False
    return (wmin is None or wl >= wmin) and (wmax is None or wl <= wmax)


def stack_epochs(mjds, results, wmin=None, wmax=None):
    """Median-stack exposures per survey pass, using only those whose wavelength
    at the target is inside [wmin, wmax]. results[i] is fetch_cutout's tuple.
    Passes are defined on ALL exposures, so n_exposures_total does not depend
    on the filter; a pass with nothing in range is dropped."""
    # SPHEREx has a linear variable filter: each exposure sees the source at a
    # different wavelength. Median-stacking a whole survey pass averages that out.
    stacks, meta = [], []
    for g in group_epochs(mjds):
        use = [i for i in g if in_range(results[i][3], wmin, wmax)]
        if not use:
            continue
        with warnings.catch_warnings():  # edge pixels with no coverage are NaN: fine
            warnings.simplefilter("ignore", RuntimeWarning)
            stacks.append(np.nanmedian([results[i][0] for i in use], axis=0))
        wls = [results[i][3] for i in use if results[i][3] is not None]
        meta.append({
            "date": Time(mjds[use[0]], format="mjd").iso[:10],
            "mjd": round(mjds[use[0]], 3),
            "n_exposures": len(use),
            "n_exposures_total": len(g),
            "wavelength_um": round(float(np.median(wls)), 4) if wls else None,
            "wavelength_min_um": round(min(wls), 4) if wls else None,
            "wavelength_max_um": round(max(wls), 4) if wls else None,
            "flagged_fraction": round(float(np.mean([results[i][1] for i in use])), 3),
            "artifact_fraction": round(float(np.mean([results[i][2] for i in use])), 3),
        })
    return stacks, meta


def single_exposures(mjds, bands, results, wmin=None, wmax=None, limit=None):
    """Exposure ("asteroid") mode: one frame per single exposure, in time order.
    Fast movers shift within one survey pass, so stacking the pass would smear them.

    Every exposure sees a different wavelength, so sky level and noise differ from
    frame to frame. Each frame is normalised to its own background: median
    subtracted, then divided by its robust noise (MAD), so frames are in units of
    background sigma and can share one stretch.
    Returns (frames, meta, n_total); n_total counts frames before `limit`."""
    order = sorted((i for i in range(len(mjds))
                    if in_range(results[i][3], wmin, wmax) and np.isfinite(results[i][0]).any()),
                   key=lambda i: mjds[i])
    n_total = len(order)
    frames, meta = [], []
    for i in order[:limit]:
        img, bad, art, wl = results[i]
        bg = np.nanmedian(img)
        sigma = 1.4826 * np.nanmedian(np.abs(img - bg))
        frames.append((img - bg) / (sigma if sigma > 0 else 1.0))
        wl = None if wl is None else round(wl, 4)
        meta.append({
            "date": Time(mjds[i], format="mjd").iso[:10],
            "time": Time(mjds[i], format="mjd").isot[:19],
            "mjd": round(mjds[i], 5),
            "det": bands[i],
            "n_exposures": 1,
            "n_exposures_total": 1,
            "wavelength_um": wl, "wavelength_min_um": wl, "wavelength_max_um": wl,
            "flagged_fraction": round(bad, 3),
            "artifact_fraction": round(art, 3),
        })
    return frames, meta, n_total


# ---------- photometry (spectrum, light curve) ----------

AP_RADIUS = 2.0          # aperture radius in pixels (about 12")
SKY_IN, SKY_OUT = 4.0, 7.0   # local sky annulus in pixels
MIN_PHOT_PIXELS = 2 * int(SKY_OUT) + 1   # smallest grid the annulus fits in
MJY_SR_TO_MJY = (np.radians(PIXSCALE_DEG) ** 2) * 1e9   # (MJy/sr summed over pixels) -> mJy
BAD_NAMES = {0: "TRANSIENT", 1: "OVERFLOW", 2: "SUR_ERROR", 6: "NONFUNC", 7: "DICHROIC",
             9: "MISSING_DATA", 10: "HOT", 11: "COLD", 15: "NONLINEAR", 17: "PERSIST", 19: "OUTLIER"}


def aperture_flux(img, var, sky_img=None):
    """Brightness of whatever sits at the centre of the grid (the requested position).

    Sum of the pixels within AP_RADIUS, minus the local sky (median of an annulus,
    taken from sky_img if given), converted from MJy/sr to mJy. The error comes from
    the VARIANCE pixels in the aperture plus the uncertainty of the sky level. No
    aperture correction: a few per cent of a point source's light falls outside,
    more at long wavelengths.
    Returns (flux_mJy, error_mJy), or None when a pixel in the aperture has no value."""
    ny, nx = img.shape
    if min(ny, nx) < MIN_PHOT_PIXELS:
        return None
    yy, xx = np.mgrid[0:ny, 0:nx]
    r = np.hypot(xx - (nx - 1) / 2, yy - (ny - 1) / 2)
    ap = r <= AP_RADIUS
    sky = (img if sky_img is None else sky_img)[(r >= SKY_IN) & (r <= SKY_OUT)]
    sky = sky[np.isfinite(sky)]
    if not np.isfinite(img[ap]).all() or sky.size < 20:
        return None
    level = np.median(sky)
    sky_sigma = 1.4826 * np.median(np.abs(sky - level))
    n_ap = int(ap.sum())
    flux = float((img[ap] - level).sum())
    v = var[ap]
    v = float(np.nansum(v)) if np.isfinite(v).any() else n_ap * sky_sigma**2
    err = float(np.sqrt(v + n_ap**2 * sky_sigma**2 / sky.size))
    return flux * MJY_SR_TO_MJY, err * MJY_SR_TO_MJY


def measure_target(raw, var, masked, flags, w_in, wcs_out):
    """Brightness at the target in one exposure, as {flux, error, flags}, or None.

    raw/var/masked are on the common grid (target at the centre). The aperture sum
    uses raw, because the core of a bright star is often flagged (OVERFLOW, NONLINEAR,
    PERSIST...) and masking it would leave nothing to measure; the sky level uses
    masked. `flags` lists the bad-pixel flags found within the aperture on the
    detector: an empty list means a clean measurement, anything else means the
    flux is unreliable (a lower limit if the star saturated)."""
    f = aperture_flux(raw, var, masked)
    if f is None:
        return None
    try:
        x, y = w_in.all_world2pix(*wcs_out.wcs.crval, 0)
        yy, xx = np.mgrid[0:flags.shape[0], 0:flags.shape[1]]
        near = np.hypot(xx - x, yy - y) <= AP_RADIUS + 0.5
        bits = int(np.bitwise_or.reduce(flags[near] & BAD_MASK)) if near.any() else 0
    except Exception:
        bits = 0
    return {"flux": f[0], "error": f[1], "flags": [n for b, n in BAD_NAMES.items() if bits >> b & 1]}


WING_IN, WING_OUT = 8.0, 11.0    # ring used when the core is saturated, in pixels
WING_SKY_IN = 12.5               # everything further out is the reference level
MIN_WING_PIXELS = 30             # grid needed for that (fov 0.05 deg)


def wing_flux(img):
    """Relative brightness of a star whose core is saturated, from the light in its wings.

    Very bright stars have no usable pixel within several pixels of the centre, but
    the outer part of their image is fine and scales with the star's brightness.
    Returns (flux_mJy, error_mJy) for the light in a ring WING_IN..WING_OUT pixels
    out, above the level at the edge of the grid; None if the ring is mostly masked.
    This is a fraction of the star's light, not its flux: good for seeing a star
    brighten or fade at one wavelength, not for comparing with catalogues."""
    ny, nx = img.shape
    if min(ny, nx) < MIN_WING_PIXELS:
        return None
    yy, xx = np.mgrid[0:ny, 0:nx]
    r = np.hypot(xx - (nx - 1) / 2, yy - (ny - 1) / 2)
    ring = (r >= WING_IN) & (r <= WING_OUT)
    w = img[ring]
    w = w[np.isfinite(w)]
    ref = img[(r >= WING_SKY_IN) & (r <= (min(ny, nx) - 1) / 2)]
    ref = ref[np.isfinite(ref)]
    if w.size < 0.5 * ring.sum() or ref.size < 20:
        return None
    n_ring = int(ring.sum())
    level = np.median(w) - np.median(ref)
    err = 1.2533 * np.std(w) / np.sqrt(w.size)   # error of a median
    return float(level * n_ring * MJY_SR_TO_MJY), float(err * n_ring * MJY_SR_TO_MJY)


def spectrum_points(e, wmin=None, wmax=None):
    """One point per exposure: the target's brightness at the wavelength that exposure saw it.
    e is cache.get_exposures' dict. Returns (points sorted by wavelength, n_skipped)."""
    pts, skipped = [], 0
    for mjd, band, res, ph in zip(e["mjds"], e["bands"], e["results"], e["phot"]):
        wl = res[3]
        if wl is None or not in_range(wl, wmin, wmax):
            continue
        if ph is None:
            skipped += 1
            continue
        pts.append({"wavelength_um": round(wl, 4), "flux": round(ph["flux"], 4),
                    "error": round(ph["error"], 4), "mjd": round(mjd, 5), "det": band,
                    "flags": ph["flags"]})
    return sorted(pts, key=lambda p: p["wavelength_um"]), skipped


def wing_points(e, wmin=None, wmax=None):
    """Like spectrum_points, but measured in the wings (see wing_flux)."""
    pts = []
    for mjd, band, res in zip(e["mjds"], e["bands"], e["results"]):
        wl = res[3]
        if wl is None or not in_range(wl, wmin, wmax):
            continue
        f = wing_flux(res[0])
        if f is not None:
            pts.append({"wavelength_um": round(wl, 4), "flux": round(f[0], 4), "error": round(f[1], 4),
                        "mjd": round(mjd, 5), "det": band, "flags": ["SATURATED"]})
    return pts


def lightcurve_points(e, wmin=None, wmax=None):
    """One point per survey pass: median brightness of the pass's exposures.
    Returns (points, method).

    method "aperture": the normal measurement. Clean exposures are used when the
    pass has any; otherwise the flagged ones are used and the point says so.
    method "wings": used when the core could not be measured in most exposures
    (the star saturates): relative brightness from the wings, every point flagged.
    The error is the scatter between the exposures (they are at different
    wavelengths, so it includes the slope of the spectrum), or the single
    exposure's own error when only one is used."""
    pts, skipped = spectrum_points(e, wmin, wmax)
    method = "aperture"
    if len(pts) < skipped:
        wings = wing_points(e, wmin, wmax)
        if len(wings) > len(pts):
            pts, method = wings, "wings"
    pts.sort(key=lambda p: p["mjd"])
    out = []
    for g in group_epochs([p["mjd"] for p in pts]) if pts else []:
        clean = [i for i in g if not pts[i]["flags"]]
        use = clean or g
        f = np.array([pts[i]["flux"] for i in use])
        err = float(np.std(f, ddof=1) / np.sqrt(len(use))) if len(use) > 1 else pts[use[0]]["error"]
        out.append({"mjd": round(float(np.median([pts[i]["mjd"] for i in use])), 3),
                    "date": Time(pts[g[0]]["mjd"], format="mjd").iso[:10],
                    "flux": round(float(np.median(f)), 4), "error": round(err, 4),
                    "n_exposures": len(use), "n_exposures_total": len(g),
                    "wavelength_um": round(float(np.median([pts[i]["wavelength_um"] for i in use])), 4),
                    "flagged": not clean,
                    "flags": sorted({n for i in use for n in pts[i]["flags"]})})
    return out, method


# ---------- motion track ----------

SEARCH_R = 3.0     # px: how far the target may sit from where it was in the previous pass
CENTROID_R = 2.0   # px: window for the centroid
MIN_SNR = 5.0      # weaker detections are not used
ERR_SCALE = 2.5    # the noise-only centroid error is too small by this much (measured on simulated stars)
SATURATED_ERR = 0.5   # px: error floor when the core has no data (the ring is often lopsided)
SATURATED_R = 4.0     # px: wider centroid window around a core without data
MIN_TRACK_PIXELS = 2 * int(SEARCH_R + CENTROID_R) + 1 + 6


def _box3(a):
    """3x3 mean, NaN counted as 0 (cheap smoothing for finding the peak)."""
    p = np.pad(np.nan_to_num(a), 1)
    return sum(p[dy:dy + a.shape[0], dx:dx + a.shape[1]] for dy in range(3) for dx in range(3)) / 9.0


def centroid(img, x0, y0, search=SEARCH_R):
    """Find the source nearest (x0, y0) (pixels, 0-based) and measure its centre.

    Of the peaks (local maxima of the 3x3-smoothed image) detected at MIN_SNR within
    `search` px, the one closest to (x0, y0) is taken, then an intensity-weighted
    centroid in a CENTROID_R window, iterated. Returns {x, y, ex, ey, snr, masked}
    or None if nothing is detected at MIN_SNR. ex/ey come from the background noise.
    `masked` counts NaN pixels in the window (a saturated core): the centroid of the
    remaining ring is still centred, but less precise."""
    ny, nx = img.shape
    finite = img[np.isfinite(img)]
    if finite.size < 20:
        return None
    bg = np.median(finite)
    noise = 1.4826 * np.median(np.abs(finite - bg))
    if not noise > 0:
        return None
    yy, xx = np.mgrid[0:ny, 0:nx]
    sm = _box3(img - bg)
    dist = np.hypot(xx - x0, yy - y0)
    p = np.pad(sm, 1, constant_values=-np.inf)
    peak = np.all([sm >= p[1 + dy:1 + dy + ny, 1 + dx:1 + dx + nx]
                   for dy in (-1, 0, 1) for dx in (-1, 0, 1)], axis=0)
    cand = peak & (dist <= search) & (sm / (noise / 3.0) >= MIN_SNR)
    if not cand.any():
        return None
    k = np.argmin(np.where(cand, dist, np.inf))
    py, px = np.unravel_index(k, sm.shape)
    snr = float(sm[py, px] / (noise / 3.0))
    xc, yc = float(px), float(py)
    # a saturated core has no data: the peak is then on its rim, and a window wide
    # enough to hold the whole rim is needed for the centroid to find the middle
    rad = CENTROID_R
    if (~np.isfinite(img[np.hypot(xx - xc, yy - yc) <= CENTROID_R])).any():
        rad = SATURATED_R
    for _ in range(20):
        win = np.hypot(xx - xc, yy - yc) <= rad
        v = np.where(win & np.isfinite(img), np.clip(img - bg, 0, None), 0.0)
        f = v.sum()
        if not f > 0:
            return None
        nxc, nyc = float((v * xx).sum() / f), float((v * yy).sum() / f)
        done = abs(nxc - xc) + abs(nyc - yc) < 1e-4
        xc, yc = nxc, nyc
        if done:
            break
    ok = win & np.isfinite(img)
    masked = int((win & ~np.isfinite(img)).sum())
    floor = SATURATED_ERR if masked else 0.02
    ex = ERR_SCALE * float(np.sqrt((noise**2 * (xx[ok] - xc) ** 2).sum()) / f)
    ey = ERR_SCALE * float(np.sqrt((noise**2 * (yy[ok] - yc) ** 2).sum()) / f)
    return {"x": xc, "y": yc, "ex": max(ex, floor), "ey": max(ey, floor), "snr": round(snr, 1),
            "masked": masked}


def track_points(e, ra, dec, fov):
    """Centroid of the target in each survey pass (median stack of the pass).
    The first pass is searched around the requested position, each later pass around
    where the target was before, so a fast mover is followed from pass to pass.
    The error is the larger of the centroid's own error and the scatter of the
    centroids in the pass's single exposures (when at least 3 of them detect it)."""
    wcs, _ = target_grid(ra, dec, fov)
    stacks, meta = stack_epochs(e["mjds"], e["results"])
    groups = group_epochs(e["mjds"])
    n = stacks[0].shape[0] if stacks else 0
    x0 = y0 = (n - 1) / 2
    pts = []
    for s, m, g in zip(stacks, meta, groups):
        c = centroid(s, x0, y0)
        mjd = float(np.mean([e["mjds"][i] for i in g]))
        if c is None:
            pts.append({"mjd": round(mjd, 4), "date": m["date"], "detected": False})
            continue
        x0, y0 = c["x"], c["y"]
        err_px = float(np.hypot(c["ex"], c["ey"]) / np.sqrt(2))
        singles = [s1 for s1 in (centroid(e["results"][i][0], c["x"], c["y"], search=1.5) for i in g) if s1]
        if len(singles) >= 3:
            sx = np.std([s1["x"] for s1 in singles], ddof=1)
            sy = np.std([s1["y"] for s1 in singles], ddof=1)
            err_px = max(err_px, float(np.hypot(sx, sy) / np.sqrt(2) / np.sqrt(len(singles))))
        pra, pdec = (float(v) for v in wcs.all_pix2world(c["x"], c["y"], 0))
        pts.append({"mjd": round(mjd, 4), "date": m["date"], "detected": True,
                    "ra": round(pra, 7), "dec": round(pdec, 7),
                    "err": round(err_px * PIXSCALE_DEG * 3.6e6, 1),
                    "snr": c["snr"], "n_exposures": m["n_exposures"],
                    "saturated": c["masked"] > 0})
    return pts


def fit_proper_motion(pts):
    """Straight-line fit of position against time, weighted by the errors.
    Returns {pmra, pmdec, pmra_err, pmdec_err} in mas/yr (pmra includes cos(dec)),
    or None with fewer than two detections or under 30 days between them.
    With 3+ points the errors are scaled up by the scatter if it is larger than
    the centroid errors suggest. Parallax is not fitted: SPHEREx passes are about
    6 months apart, so a nearby star's parallax adds an alternating offset."""
    p = [q for q in pts if q.get("detected")]
    clean = [q for q in p if not q["saturated"]]
    if len(clean) >= 2:
        p = clean   # saturated centroids are only used when there is nothing better
    if len(p) < 2:
        return None
    t = np.array([q["mjd"] for q in p]) / 365.25
    if t.max() - t.min() < 30 / 365.25:
        return None
    dec0 = np.radians(np.mean([q["dec"] for q in p]))
    ra_ref = p[0]["ra"]
    x = np.array([((q["ra"] - ra_ref + 180) % 360 - 180) for q in p]) * np.cos(dec0) * 3.6e6
    y = np.array([q["dec"] for q in p]) * 3.6e6
    w = 1.0 / np.array([q["err"] for q in p]) ** 2
    out = {}
    for name, v in (("pmra", x), ("pmdec", y)):
        tw, vw = np.average(t, weights=w), np.average(v, weights=w)
        sxx = float((w * (t - tw) ** 2).sum())
        slope = float((w * (t - tw) * (v - vw)).sum() / sxx)
        var = 1.0 / sxx
        if len(p) > 2:
            resid = v - (vw + slope * (t - tw))
            var *= max(1.0, float((w * resid**2).sum()) / (len(p) - 2))
        out[name], out[name + "_err"] = round(slope, 1), round(float(np.sqrt(var)), 1)
    out["n_epochs"] = len(p)
    out["saturated"] = any(q["saturated"] for q in p)
    out["years"] = round(float(t.max() - t.min()), 2)
    return out


# ---------- colour image ----------

RGB_CHANNELS = {"red": "D6", "green": "D3", "blue": "D1"}


def deep_stack(e):
    """Median of every exposure of one detector: the deepest image we have."""
    with warnings.catch_warnings():
        warnings.simplefilter("ignore", RuntimeWarning)
        return np.nanmedian([r[0] for r in e["results"]], axis=0)


def colour_image(red, green, blue):
    """Infrared colour picture from three images on the same grid.
    Each channel is normalised on its own (sky subtracted, divided by its 99.5th
    percentile) and given an asinh stretch, so faint and bright sources both show.
    Colours therefore compare a source with the rest of the field, not absolute fluxes."""
    chans = []
    for a in (red, green, blue):
        fin = a[np.isfinite(a)]
        if fin.size == 0:
            chans.append(np.zeros_like(a))
            continue
        v = a - np.median(fin)
        top = np.percentile(v[np.isfinite(v)], 99.5)
        v = v / (top if top > 0 else 1.0)
        v = np.arcsinh(np.clip(v, 0, None) / 0.1) / np.arcsinh(1 / 0.1)
        chans.append(np.nan_to_num(np.clip(v, 0, 1)))
    rgb = (np.flipud(np.stack(chans, axis=-1)) * 255).astype(np.uint8)  # FITS y-up -> image y-down
    return Image.fromarray(rgb, "RGB")


def fetch_exposures(ra, dec, fov, det, progress=None):
    """Download every exposure covering the position, on one common grid.
    Returns {mjds, bands, results, phot, grid, n_failed}; results[i] is
    (image, bad_fraction, artifact_fraction, wavelength_um), phot[i] the brightness
    at the target (or None). No wavelength filter and no stacking here: both are cheap and done
    per request (stack_epochs), so this slow step is cached once per position.

    progress(done, total) is called after every image, so a job can report progress."""
    rows = find_images(ra, dec, fov, det)
    if not rows:
        raise NoData("No SPHEREx images cover this position")

    wcs_out, shape = target_grid(ra, dec, fov)
    if progress:
        progress(0, len(rows))
    results = [None] * len(rows)
    with cf.ThreadPoolExecutor(max_workers=8) as ex:
        futures = {ex.submit(fetch_cutout, r["uri"], wcs_out, shape, ra, dec): i
                   for i, r in enumerate(rows)}
        for n, fut in enumerate(cf.as_completed(futures), start=1):
            results[futures[fut]] = fut.result()
            if progress:
                progress(n, len(rows))

    keep = [(r, res) for r, res in zip(rows, results) if res is not None]
    if not keep:
        raise NoData("Images found but all downloads failed")
    return {
        "mjds": [k[0]["mjd"] for k in keep],
        "bands": [k[0]["band"].replace("SPHEREx-", "") for k in keep],
        "results": [k[1][:4] for k in keep],
        "phot": [k[1][4] for k in keep],
        "grid": {"width": shape[1], "height": shape[0], "pixscale_arcsec": PIXSCALE_DEG * 3600},
        "n_failed": len(rows) - len(keep),
    }


# ---------- rendering ----------

def shared_limits(stacks):
    pix = np.concatenate([s[np.isfinite(s)] for s in stacks])
    if pix.size == 0:
        return 0.0, 1.0
    return ZScaleInterval().get_limits(pix)


def gray_image(arr, vmin, vmax):
    a = np.clip((arr - vmin) / (vmax - vmin + 1e-12), 0, 1)
    a = np.nan_to_num(a, nan=0.0)
    return Image.fromarray((np.flipud(a) * 255).astype(np.uint8), "L")  # FITS y-up -> image y-down


def diverging_image(arr):
    lim = np.nanpercentile(np.abs(arr), 99) or 1.0
    a = np.nan_to_num(np.clip(arr / lim, -1, 1))
    r = np.where(a > 0, 255, 255 * (1 + a))
    b = np.where(a < 0, 255, 255 * (1 - a))
    g = 255 * (1 - np.abs(a))
    rgb = np.flipud(np.stack([r, g, b], axis=-1)).astype(np.uint8)
    return Image.fromarray(rgb, "RGB")


def png_bytes(img):
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()


def to_png_gray(arr, vmin, vmax):
    return _data_url(gray_image(arr, vmin, vmax))


def to_png_diverging(arr):
    return _data_url(diverging_image(arr))


def _data_url(img):
    return "data:image/png;base64," + base64.b64encode(png_bytes(img)).decode()
