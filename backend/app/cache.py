"""Disk cache: raw stacks are saved, so diff/add/stretch changes are instant."""
import hashlib
import json

import numpy as np
from fastapi import HTTPException

from . import spherex
from .config import CACHE_DIR, MOCK


def cache_key(ra, dec, fov, det):
    """Also the job key: identical requests share one cache entry and one running job."""
    s = f"{'mock' if MOCK else spherex.RELEASE}|{ra:.5f}|{dec:.5f}|{fov:.4f}|{det}"
    return hashlib.sha1(s.encode()).hexdigest()[:16]


def load_cached(ra, dec, fov, det):
    """Return (stacks, meta, grid) if this request is already on disk, else None."""
    k = cache_key(ra, dec, fov, det)
    npz, js = CACHE_DIR / f"{k}.npz", CACHE_DIR / f"{k}.json"
    if not (npz.exists() and js.exists()):
        return None
    d = np.load(npz)
    info = json.loads(js.read_text())
    return [d[f"s{i}"] for i in range(len(info["meta"]))], info["meta"], info["grid"]


def compute_and_save(ra, dec, fov, det, progress=None):
    """Do the slow work (download, align, stack) and write it to the cache.
    Raises HTTPException (404 no data, 502 IRSA failed). Call it from a job, not a request."""
    CACHE_DIR.mkdir(exist_ok=True)
    if MOCK:
        from .mock import mock_stacks
        stacks, meta, grid = mock_stacks(ra, dec, fov, det)
    else:
        try:
            stacks, meta, grid = spherex.build_stacks(ra, dec, fov, det, progress=progress)
        except spherex.NoData as e:
            raise HTTPException(404, str(e))
        except Exception as e:
            raise HTTPException(502, f"IRSA request failed: {e}")

    k = cache_key(ra, dec, fov, det)
    npz, js = CACHE_DIR / f"{k}.npz", CACHE_DIR / f"{k}.json"
    np.savez_compressed(npz, **{f"s{i}": s for i, s in enumerate(stacks)})
    js.write_text(json.dumps({"meta": meta, "grid": grid,
                              "query": {"ra": ra, "dec": dec, "fov": fov, "det": det}}))
    return stacks, meta, grid


def get_stacks(ra, dec, fov, det):
    """Blocking version: cached result, or compute it now. For scripts and mock mode;
    the API uses jobs.py so requests never wait for a slow download."""
    return load_cached(ra, dec, fov, det) or compute_and_save(ra, dec, fov, det)
