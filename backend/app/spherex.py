"""
SPHEREx data access: find images, download cutouts, stack per epoch, render PNGs.
Pure functions, no web code here, so it can be tested from a notebook.
"""
import base64
import concurrent.futures as cf
import io
import os
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

# FLAGS bits (from the FLAGS header, MSKNnnnn keywords / Explanatory Supplement Table 16).
# NB: bit 21 SOURCE is set on almost every pixel with a star on it, so never mask "flags != 0".
BAD_BITS = [0, 1, 2, 6, 7, 9, 10, 11, 15, 17, 19]
# TRANSIENT OVERFLOW SUR_ERROR NONFUNC DICHROIC MISSING HOT COLD NONLINEAR PERSIST OUTLIER
ARTIFACT_BITS = [20, 22, 23, 24, 25, 26, 27, 28]
# CROSSTALK GHOST GHOST_FPA GHOST_EXT STREAK BLOOM SNOWBALL HALO -> can fake a "mover", so we
# report them per frame (artifact_fraction) instead of hiding pixels.
BAD_MASK = sum(1 << b for b in BAD_BITS)
ARTIFACT_MASK = sum(1 << b for b in ARTIFACT_BITS)


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


def _to_common_grid(img, flags, w_in, wcs_out, shape):
    """Mask bad pixels and reproject onto the target grid.
    Returns (image, bad_fraction, artifact_fraction)."""
    from reproject import reproject_interp

    bad = ((flags & BAD_MASK) != 0).astype(float)
    art = ((flags & ARTIFACT_MASK) != 0).astype(float)
    img = img.copy()
    img[bad > 0] = np.nan
    out, _ = reproject_interp((img, w_in), wcs_out, shape_out=shape)
    # fractions measured on the original pixels (reprojection would blur single pixels)
    return out, float(bad.mean()), float(art.mean())


def _fetch_cutout_s3(uri, wcs_out, shape):
    """Read only the needed pixel box of IMAGE, ZODI and FLAGS from S3 (range requests)."""
    from astropy.coordinates import SkyCoord

    from .s3io import open_remote, s3_url_from_access_url

    ra, dec = wcs_out.wcs.crval
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
    finally:
        hdul.close()
    return _to_common_grid(img, flags, w_in[y0:y1, x0:x1], wcs_out, shape)


def _fetch_cutout_irsa(uri, wcs_out, shape):
    """Download one cutout from IRSA's cutout service (slower, sometimes 503 'busy')."""
    with fits.open(uri, memmap=False) as hdul:
        img = hdul["IMAGE"].data.astype(float) - hdul["ZODI"].data
        flags = hdul["FLAGS"].data.astype(np.int64)
        w_in = WCS(hdul["IMAGE"].header)  # primary = sky WCS (TAN-SIP)
    return _to_common_grid(img, flags, w_in, wcs_out, shape)


def fetch_cutout(uri, wcs_out, shape):
    """Get one exposure's pixels around the target: subtract zodiacal light, mask bad pixels,
    put on the common grid. Returns (image, bad_fraction, artifact_fraction) or None.

    IMAGE is in MJy/sr with zodiacal light NOT subtracted, so we subtract ZODI.
    Later (spectra): the per-pixel wavelength is
        WCS(hdul["IMAGE"].header, fobj=hdul, key="W") with .sip = None

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
            return fn(uri, wcs_out, shape)
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


def build_stacks(ra, dec, fov, det):
    """Main pipeline. Returns (stacks, meta, grid) with raw float arrays."""
    rows = find_images(ra, dec, fov, det)
    if not rows:
        raise NoData("No SPHEREx images cover this position")

    wcs_out, shape = target_grid(ra, dec, fov)
    with cf.ThreadPoolExecutor(max_workers=8) as ex:
        results = list(ex.map(lambda r: fetch_cutout(r["uri"], wcs_out, shape), rows))

    keep = [(r, res) for r, res in zip(rows, results) if res is not None]
    if not keep:
        raise NoData("Images found but all downloads failed")
    rows = [k[0] for k in keep]
    imgs = [k[1][0] for k in keep]
    bads = [k[1][1] for k in keep]
    arts = [k[1][2] for k in keep]
    mjds = [r["mjd"] for r in rows]

    # SPHEREx has a linear variable filter: each exposure sees the source at a
    # different wavelength. Median-stacking a whole survey pass averages that out.
    stacks, meta = [], []
    for g in group_epochs(mjds):
        with warnings.catch_warnings():  # edge pixels with no coverage are NaN: fine
            warnings.simplefilter("ignore", RuntimeWarning)
            stacks.append(np.nanmedian([imgs[i] for i in g], axis=0))
        meta.append({
            "date": Time(mjds[g[0]], format="mjd").iso[:10],
            "mjd": round(mjds[g[0]], 3),
            "n_exposures": len(g),
            "flagged_fraction": round(float(np.mean([bads[i] for i in g])), 3),
            "artifact_fraction": round(float(np.mean([arts[i] for i in g])), 3),
        })
    grid = {"width": shape[1], "height": shape[0], "pixscale_arcsec": PIXSCALE_DEG * 3600}
    return stacks, meta, grid


# ---------- rendering ----------

def shared_limits(stacks):
    pix = np.concatenate([s[np.isfinite(s)] for s in stacks])
    if pix.size == 0:
        return 0.0, 1.0
    return ZScaleInterval().get_limits(pix)


def to_png_gray(arr, vmin, vmax):
    a = np.clip((arr - vmin) / (vmax - vmin + 1e-12), 0, 1)
    a = np.nan_to_num(a, nan=0.0)
    img = Image.fromarray((np.flipud(a) * 255).astype(np.uint8), "L")  # FITS y-up -> image y-down
    return _data_url(img)


def to_png_diverging(arr):
    lim = np.nanpercentile(np.abs(arr), 99) or 1.0
    a = np.nan_to_num(np.clip(arr / lim, -1, 1))
    r = np.where(a > 0, 255, 255 * (1 + a))
    b = np.where(a < 0, 255, 255 * (1 - a))
    g = 255 * (1 - np.abs(a))
    rgb = np.flipud(np.stack([r, g, b], axis=-1)).astype(np.uint8)
    return _data_url(Image.fromarray(rgb, "RGB"))


def _data_url(img):
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return "data:image/png;base64," + base64.b64encode(buf.getvalue()).decode()
