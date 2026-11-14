"""Disk cache of single exposures.

The slow part (IRSA query + downloads) is cached once per (position, fov,
detector). Wavelength filtering, stacking, diff/add and stretch are computed
from the cached exposures on every request, so changing them is instant.
"""
import hashlib
import json
from functools import lru_cache

import numpy as np
from fastapi import HTTPException

from . import spherex
from .config import CACHE_DIR, MOCK

CACHE_VERSION = 3  # bump when the cached format changes (3: per-exposure cache)


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


def get_exposures(ra, dec, fov, det):
    """All exposures for a position: {mjds, bands, results, grid}.
    results[i] = (image, flagged_fraction, artifact_fraction, wavelength_um)."""
    CACHE_DIR.mkdir(exist_ok=True)
    k = _key(ra, dec, fov, det)
    npz, js = CACHE_DIR / f"{k}.npz", CACHE_DIR / f"{k}.json"
    if not (npz.exists() and js.exists()):
        if MOCK:
            from .mock import mock_exposures
            e = mock_exposures(ra, dec, fov, det)
        else:
            try:
                e = spherex.fetch_exposures(ra, dec, fov, det)
            except spherex.NoData as err:
                raise HTTPException(404, str(err))
            except Exception as err:
                raise HTTPException(502, f"IRSA request failed: {err}")
        res = e["results"]
        np.savez_compressed(npz, imgs=np.array([r[0] for r in res], dtype=np.float32))
        js.write_text(json.dumps({
            "query": {"ra": ra, "dec": dec, "fov": fov, "det": det},
            "grid": e["grid"], "mjds": e["mjds"], "bands": e["bands"],
            "flagged": [r[1] for r in res], "artifact": [r[2] for r in res],
            "wavelength_um": [r[3] for r in res], "n_failed": e.get("n_failed", 0),
        }))
    return _load(k)


def get_stacks(ra, dec, fov, det, wmin=None, wmax=None):
    """One stacked image per survey pass, from exposures inside [wmin, wmax] um."""
    e = get_exposures(ra, dec, fov, det)
    stacks, meta = spherex.stack_epochs(e["mjds"], e["results"], wmin, wmax)
    if not stacks:
        raise HTTPException(404, f"None of the {len(e['mjds'])} exposures see this position "
                                 f"between {wmin} and {wmax} um")
    return stacks, meta, e["grid"]
