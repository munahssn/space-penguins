"""Disk cache: raw stacks are saved, so diff/add/stretch changes are instant."""
import hashlib
import json

import numpy as np
from fastapi import HTTPException

from . import spherex
from .config import CACHE_DIR, MOCK


def _key(ra, dec, fov, det):
    s = f"{'mock' if MOCK else spherex.RELEASE}|{ra:.5f}|{dec:.5f}|{fov:.4f}|{det}"
    return hashlib.sha1(s.encode()).hexdigest()[:16]


def get_stacks(ra, dec, fov, det):
    CACHE_DIR.mkdir(exist_ok=True)
    k = _key(ra, dec, fov, det)
    npz, js = CACHE_DIR / f"{k}.npz", CACHE_DIR / f"{k}.json"
    if npz.exists() and js.exists():
        d = np.load(npz)
        info = json.loads(js.read_text())
        return [d[f"s{i}"] for i in range(len(info["meta"]))], info["meta"], info["grid"]

    if MOCK:
        from .mock import mock_stacks
        stacks, meta, grid = mock_stacks(ra, dec, fov, det)
    else:
        try:
            stacks, meta, grid = spherex.build_stacks(ra, dec, fov, det)
        except spherex.NoData as e:
            raise HTTPException(404, str(e))
        except Exception as e:
            raise HTTPException(502, f"IRSA request failed: {e}")

    np.savez_compressed(npz, **{f"s{i}": s for i, s in enumerate(stacks)})
    js.write_text(json.dumps({"meta": meta, "grid": grid,
                              "query": {"ra": ra, "dec": dec, "fov": fov, "det": det}}))
    return stacks, meta, grid
