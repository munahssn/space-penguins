"""
SPHEREx Blink API.

Run (from backend/):
    uvicorn app.main:app --reload              # real data from IRSA
    SPHEREX_MOCK=1 uvicorn app.main:app --reload   # fake data, no internet
    (Windows PowerShell: $env:SPHEREX_MOCK=1; uvicorn app.main:app --reload)

Open http://localhost:8000 for the frontend, http://localhost:8000/docs for the API.
"""
import hashlib
import json
import os
from pathlib import Path

import numpy as np
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from . import spherex
from .targets import targets_now

MOCK = os.environ.get("SPHEREX_MOCK") == "1"
CACHE_DIR = Path(__file__).resolve().parent.parent / "cache"
FRONTEND_DIR = Path(__file__).resolve().parents[2] / "frontend"
DETECTORS = {"D1", "D2", "D3", "D4", "D5", "D6", "all"}

app = FastAPI(title="SPHEREx Blink API")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["GET"], allow_headers=["*"])


# ---------- cache: raw stacks on disk, so diff/add/stretch changes are instant ----------

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


def _check(ra, dec, fov, det):
    if not (0 <= ra < 360 and -90 <= dec <= 90):
        raise HTTPException(422, "ra must be 0-360, dec -90..90 (degrees)")
    if not (0.005 <= fov <= 0.5):
        raise HTTPException(422, "fov must be between 0.005 and 0.5 degrees")
    if det not in DETECTORS:
        raise HTTPException(422, f"det must be one of {sorted(DETECTORS)}")


# ---------- endpoints ----------

@app.get("/api/health")
def health():
    return {"ok": True, "mock": MOCK, "release": spherex.RELEASE}


@app.get("/api/targets")
def targets():
    return targets_now()


@app.get("/api/frames")
def frames(ra: float, dec: float, fov: float = 0.1, det: str = "D3"):
    _check(ra, dec, fov, det)
    stacks, meta, grid = get_stacks(ra, dec, fov, det)
    vmin, vmax = spherex.shared_limits(stacks)
    return {
        "query": {"ra": ra, "dec": dec, "fov": fov, "det": det,
                  "release": "mock" if MOCK else spherex.RELEASE},
        "grid": grid,
        "frames": [{"index": i, **m, "image": spherex.to_png_gray(s, vmin, vmax)}
                   for i, (s, m) in enumerate(zip(stacks, meta))],
    }


@app.get("/api/diff")
def diff(ra: float, dec: float, fov: float = 0.1, det: str = "D3",
         a: int = 0, b: int = -1, op: str = Query("sub", pattern="^(sub|add)$")):
    _check(ra, dec, fov, det)
    stacks, _, _ = get_stacks(ra, dec, fov, det)
    n = len(stacks)
    b = b if b >= 0 else n - 1
    if not (0 <= a < n and 0 <= b < n):
        raise HTTPException(422, f"a and b must be frame indices 0..{n - 1}")
    if op == "sub":
        img = spherex.to_png_diverging(stacks[b] - stacks[a])
    else:
        s = stacks[a] + stacks[b]
        img = spherex.to_png_gray(s, *spherex.shared_limits([s]))
    return {"a": a, "b": b, "op": op, "image": img}


@app.get("/api/spectrum")
def spectrum(ra: float, dec: float):
    raise HTTPException(501, "Spectrum extraction comes in Phase 3")


@app.get("/api/catalog")
def catalog(ra: float, dec: float, r: float = 0.05):
    raise HTTPException(501, "Gaia overlay comes in Phase 2")


# Serve the frontend from the same server (must be mounted last)
if FRONTEND_DIR.exists():
    app.mount("/", StaticFiles(directory=FRONTEND_DIR, html=True), name="frontend")
