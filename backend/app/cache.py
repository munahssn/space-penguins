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
