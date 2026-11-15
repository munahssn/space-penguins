"""Disk cache of single exposures.

The slow part (IRSA query + downloads) is cached once per (position, fov,
detector). Wavelength filtering, stacking, diff/add and stretch are computed
from the cached exposures on every request, so changing them is instant.
"""
import hashlib
import json
import os
import threading
from functools import lru_cache

import numpy as np
from fastapi import HTTPException

from . import spherex
from .config import CACHE_DIR, MAX_EXPOSURES_PER_JOB, MOCK

CACHE_VERSION = 5  # bump when the cached format changes (5: target photometry per exposure)


def _key(ra, dec, fov, det):
    s = f"v{CACHE_VERSION}|{'mock' if MOCK else spherex.RELEASE}|{ra:.5f}|{dec:.5f}|{fov:.4f}|{det}"
    return hashlib.sha1(s.encode()).hexdigest()[:16]


@lru_cache(maxsize=8)
def _load(k):
    """Read one cached position from disk (kept in memory for repeat requests)."""
    info = json.loads((CACHE_DIR / f"{k}.json").read_text())
    imgs = np.load(CACHE_DIR / f"{k}.npz")["imgs"]
    info["results"] = [(imgs[i].astype(float), b, a, w) for i, (b, a, w) in
                       enumerate(zip(info.pop("flagged"), info.pop("artifact"), info.pop("wavelength_um")))]
    return info


def _write_atomically(path, write):
    """write(tmp_path) fills a temporary file, which then replaces `path` in one step.
    Requests that run at the same time never read a half-written cache file."""
    tmp = path.with_name(f"{path.stem}.{os.getpid()}-{threading.get_ident()}.tmp{path.suffix}")
    write(tmp)
    os.replace(tmp, path)


def cache_key(ra, dec, fov, det):
    """Also the job key: identical requests share one cache entry and one running job.
    Wavelength filters are not part of it: they are applied after the download."""
    return _key(ra, dec, fov, det)


def is_cached(ra, dec, fov, det):
    k = _key(ra, dec, fov, det)
    return (CACHE_DIR / f"{k}.npz").exists() and (CACHE_DIR / f"{k}.json").exists()


def _cached_fields(det):
    """(query, key) of every downloaded field of detector `det` in the current cache format."""
    out = []
    for js in CACHE_DIR.glob("*.json"):
        try:
            q = json.loads(js.read_text())["query"]
        except Exception:
            continue
        if q.get("det") != det or set(q) - {"ra", "dec", "fov", "det"}:
            continue
        k = _key(q["ra"], q["dec"], q["fov"], q["det"])
        if k == js.stem and (CACHE_DIR / f"{k}.npz").exists():   # an older cache format has another key
            out.append((q, k))
    return out


def field_covering(ra, dec, fov, det):
    """The downloaded field of detector `det` that holds the whole (fov x fov) box around
    (ra, dec), nearest its centre: (query, key, wcs, x0, y0, cx, cy, n), or None. Cheap: no pixels
    are read. None as well when exactly this position is downloaded (use it as it is)."""
    if is_cached(ra, dec, fov, det):
        return None
    n = max(8, int(np.ceil(fov / spherex.PIXSCALE_DEG)))
    best = None
    cosd = max(np.cos(np.radians(dec)), 1e-6)
    for q, k in _cached_fields(det):
        if abs(q["dec"] - dec) > q["fov"] or abs((q["ra"] - ra + 180) % 360 - 180) * cosd > q["fov"]:
            continue   # far away (a tangent-plane projection breaks down for distant points)
        w, (ny, nx) = spherex.target_grid(q["ra"], q["dec"], q["fov"])
        px, py = (float(v) for v in w.all_world2pix(ra, dec, 0))
        if not (np.isfinite(px) and np.isfinite(py)):
            continue
        x0, y0 = int(round(px - (n - 1) / 2)), int(round(py - (n - 1) / 2))
        if x0 < 0 or y0 < 0 or x0 + n > nx or y0 + n > ny:
            continue   # the box sticks out of this field
        off = abs(px - (nx - 1) / 2) + abs(py - (ny - 1) / 2)
        if best is None or off < best[0]:
            best = (off, q, k, w, x0, y0, px - x0, py - y0, n)
    return best and best[1:]


def view_at(ra, dec, fov, det):
    """Exposures around (ra, dec) cut out of a field that is already downloaded, or None.

    Clicking a spot in a field should not download the same pixels again: if a cached field
    of detector `det` contains the whole (fov x fov) box around the point, the box is cut out
    of every exposure. The result looks like get_exposures' answer plus "wcs" (the box's sky
    WCS), "center" (pixel of (ra, dec) in the box, not exactly the middle) and "field" (the
    query of the field it came from). Photometry is redone at the point on the masked pixels;
    the VARIANCE and the flags under the point are not kept in the cache, so the error comes
    from the sky noise and a point with a masked pixel is skipped instead of flagged."""
    best = field_covering(ra, dec, fov, det)
    if best is None:
        return None
    q, k, w, x0, y0, cx, cy, n = best
    e = _load(k)
    results = [(r[0][y0:y0 + n, x0:x0 + n], r[1], r[2], r[3]) for r in e["results"]]
    phot = []
    for r in results:
        f = spherex.aperture_flux(r[0], np.full_like(r[0], np.nan), r[0], cx, cy)
        phot.append(f and {"flux": f[0], "error": f[1], "flags": []})
    return {"mjds": e["mjds"], "bands": e["bands"], "results": results, "phot": phot,
            "grid": {"width": n, "height": n, "pixscale_arcsec": spherex.PIXSCALE_DEG * 3600},
            "wcs": w[y0:y0 + n, x0:x0 + n], "center": (cx, cy),
            "field": {"ra": q["ra"], "dec": q["dec"], "fov": q["fov"], "det": q["det"]}}


def get_exposures(ra, dec, fov, det, progress=None):
    """All exposures for a position: {mjds, bands, results, phot, grid}.
    results[i] = (image, flagged_fraction, artifact_fraction, wavelength_um);
    phot[i] = {flux, error, flags} of the target in that exposure, or None.
    progress(done, total) is passed on to the download (used by jobs.py)."""
    CACHE_DIR.mkdir(exist_ok=True)
    k = _key(ra, dec, fov, det)
    npz, js = CACHE_DIR / f"{k}.npz", CACHE_DIR / f"{k}.json"
    if not (npz.exists() and js.exists()):
        if MOCK:
            from .mock import mock_exposures
            e = mock_exposures(ra, dec, fov, det)
        else:
            try:
                e = spherex.fetch_exposures(ra, dec, fov, det, progress=progress)
            except spherex.NoData as err:
                raise HTTPException(404, str(err))
            except Exception as err:
                raise HTTPException(502, f"IRSA request failed: {err}")
        res = e["results"]
        # npz first, json last: is_cached() and the check above need both files.
        _write_atomically(npz, lambda tmp: np.savez_compressed(tmp, imgs=np.array([r[0] for r in res], dtype=np.float32)))
        _write_atomically(js, lambda tmp: tmp.write_text(json.dumps({
            "query": {"ra": ra, "dec": dec, "fov": fov, "det": det},
            "grid": e["grid"], "mjds": e["mjds"], "bands": e["bands"],
            "flagged": [r[1] for r in res], "artifact": [r[2] for r in res],
            "wavelength_um": [r[3] for r in res], "n_failed": e.get("n_failed", 0),
            "phot": e["phot"],
        })))
    return _load(k)


def get_stacks(ra, dec, fov, det, wmin=None, wmax=None, mode="epoch"):
    """The frames to blink, from exposures inside [wmin, wmax] um.
    mode="epoch": one stacked image per survey pass.
    mode="exposure": one background-normalised image per single exposure."""
    e = get_exposures(ra, dec, fov, det)
    if mode == "exposure":
        stacks, meta, _ = spherex.single_exposures(e["mjds"], e["bands"], e["results"], wmin, wmax,
                                                   limit=MAX_EXPOSURES_PER_JOB)
    else:
        stacks, meta = spherex.stack_epochs(e["mjds"], e["results"], wmin, wmax)
    if not stacks:
        raise HTTPException(404, f"None of the {len(e['mjds'])} exposures see this position "
                                 f"between {wmin} and {wmax} um")
    return stacks, meta, e["grid"]
