"""Blink frames and difference/sum images."""
from fastapi import APIRouter, HTTPException, Query

from .. import spherex
from ..cache import get_stacks
from ..config import MOCK
from ..validation import check_query

router = APIRouter()


@router.get("/api/frames")
def frames(ra: float, dec: float, fov: float = 0.1, det: str = "D3"):
    check_query(ra, dec, fov, det)
    stacks, meta, grid = get_stacks(ra, dec, fov, det)
    vmin, vmax = spherex.shared_limits(stacks)
    return {
        "query": {"ra": ra, "dec": dec, "fov": fov, "det": det,
                  "release": "mock" if MOCK else spherex.RELEASE},
        "grid": grid,
        "frames": [{"index": i, **m, "image": spherex.to_png_gray(s, vmin, vmax)}
                   for i, (s, m) in enumerate(zip(stacks, meta))],
    }


@router.get("/api/diff")
def diff(ra: float, dec: float, fov: float = 0.1, det: str = "D3",
         a: int = 0, b: int = -1, op: str = Query("sub", pattern="^(sub|add)$")):
    check_query(ra, dec, fov, det)
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
