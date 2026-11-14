"""Blink frames and difference/sum images.

Both endpoints answer 202 while a new spot of sky is still being downloaded
(see jobs.py); the client polls the same URL until it gets 200. Wavelength
filtering and stacking are fast and happen on every request."""
from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import JSONResponse

from .. import jobs, spherex
from ..cache import get_stacks
from ..config import MOCK
from ..validation import check_mode, check_query, check_wavelength

router = APIRouter()


def _pending(info):
    return JSONResponse(status_code=202, content=info, headers={"Retry-After": "2"})


@router.get("/api/frames")
def frames(ra: float, dec: float, fov: float = 0.1, det: str = "D3",
           wmin: float | None = None, wmax: float | None = None, mode: str = "epoch"):
    check_query(ra, dec, fov, det)
    check_wavelength(wmin, wmax)
    check_mode(mode)
    info = jobs.pending(ra, dec, fov, det)
    if info:
        return _pending(info)
    stacks, meta, grid = get_stacks(ra, dec, fov, det, wmin, wmax, mode)
    vmin, vmax = spherex.shared_limits(stacks)
    return {
        "query": {"ra": ra, "dec": dec, "fov": fov, "det": det, "wmin": wmin, "wmax": wmax,
                  "mode": mode, "release": "mock" if MOCK else spherex.RELEASE},
        "grid": grid,
        "frames": [{"index": i, **m, "image": spherex.to_png_gray(s, vmin, vmax)}
                   for i, (s, m) in enumerate(zip(stacks, meta))],
    }


@router.get("/api/diff")
def diff(ra: float, dec: float, fov: float = 0.1, det: str = "D3",
         wmin: float | None = None, wmax: float | None = None, mode: str = "epoch",
         a: int = 0, b: int = -1, op: str = Query("sub", pattern="^(sub|add)$")):
    check_query(ra, dec, fov, det)
    check_wavelength(wmin, wmax)
    check_mode(mode)
    info = jobs.pending(ra, dec, fov, det)
    if info:
        return _pending(info)
    stacks, _, _ = get_stacks(ra, dec, fov, det, wmin, wmax, mode)
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
