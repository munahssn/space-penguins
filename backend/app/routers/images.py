"""Frames and difference images served as PNG files: GET /img/{token}.png

Instead of base64 inside the JSON, /api/frames?images=url returns a short URL per frame and the
browser fetches the images itself (smaller JSON, browser caching, <img src> works directly).

The token is the request itself (position, fov, detector, wavelength range, mode and which frame),
base64-encoded. That makes the URL stateless: after a restart or a wiped PNG cache, the image is
simply rendered again from the cached exposures. It never starts a download: if the exposures are
not cached yet, ask /api/frames first (404 here)."""
import base64
import hashlib
import json
import os

from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse

from .. import spherex
from ..cache import CACHE_VERSION, get_stacks, is_cached
from ..config import CACHE_DIR, DETECTORS, MOCK, MODES
from ..validation import check_query, check_wavelength

router = APIRouter()

PNG_DIR = CACHE_DIR / "png"
MAX_TOKEN_LEN = 400


def image_url(kind, ra, dec, fov, det, wmin, wmax, **extra):
    """URL of one image. kind "f" = blink frame (extra: i), "d" = difference (extra: a, b, op)."""
    p = {"k": kind, "ra": ra, "dec": dec, "fov": fov, "det": det, "wmin": wmin, "wmax": wmax, **extra}
    token = base64.urlsafe_b64encode(json.dumps(p, separators=(",", ":")).encode()).decode().rstrip("=")
    return f"/img/{token}.png"


def _decode(token):
    try:
        raw = base64.urlsafe_b64decode(token + "=" * (-len(token) % 4))
        p = json.loads(raw)
        num = lambda v: isinstance(v, (int, float)) and not isinstance(v, bool)  # noqa: E731
        ok = (isinstance(p, dict) and p.get("k") in ("f", "d") and num(p["ra"]) and num(p["dec"])
              and num(p["fov"]) and p["det"] in DETECTORS and p.get("mode", "epoch") in MODES
              and all(p[w] is None or num(p[w]) for w in ("wmin", "wmax")))
        if ok and p["k"] == "f":
            ok = isinstance(p["i"], int)
        if ok and p["k"] == "d":
            ok = isinstance(p["a"], int) and isinstance(p["b"], int) and p["op"] in ("sub", "add")
    except Exception:
        ok = False
    if not ok:
        raise HTTPException(422, "not a valid image link")
    return p


def _png_path(token):
    tag = f"{token}|v{CACHE_VERSION}|{'mock' if MOCK else spherex.RELEASE}"
    return PNG_DIR / (hashlib.sha1(tag.encode()).hexdigest()[:24] + ".png")


def _render(p):
    ra, dec, fov, det, wmin, wmax = p["ra"], p["dec"], p["fov"], p["det"], p["wmin"], p["wmax"]
    check_query(ra, dec, fov, det)
    check_wavelength(wmin, wmax)
    if not (MOCK or is_cached(ra, dec, fov, det)):  # mock data is instant; never start a download here
        raise HTTPException(404, "These images are not downloaded yet: ask /api/frames for this position first")
    stacks, _, _ = get_stacks(ra, dec, fov, det, wmin, wmax, p.get("mode", "epoch"))
    n = len(stacks)
    if p["k"] == "f":
        if not 0 <= p["i"] < n:
            raise HTTPException(404, f"frame index must be 0..{n - 1}")
        vmin, vmax = spherex.shared_limits(stacks)  # same stretch for every frame
        return spherex.gray_image(stacks[p["i"]], vmin, vmax)
    a, b = p["a"], p["b"] if p["b"] >= 0 else n - 1
    if not (0 <= a < n and 0 <= b < n):
        raise HTTPException(404, f"a and b must be frame indices 0..{n - 1}")
    if p["op"] == "sub":
        return spherex.diverging_image(stacks[b] - stacks[a])
    s = stacks[a] + stacks[b]
    return spherex.gray_image(s, *spherex.shared_limits([s]))


@router.get("/img/{token}.png")
def image(token: str):
    if len(token) > MAX_TOKEN_LEN:
        raise HTTPException(422, "not a valid image link")
    p = _decode(token)
    path = _png_path(token)
    if not path.exists():
        data = spherex.png_bytes(_render(p))
        PNG_DIR.mkdir(parents=True, exist_ok=True)
        tmp = path.with_suffix(f".{os.getpid()}.tmp")
        tmp.write_bytes(data)
        os.replace(tmp, path)  # atomic: a second request never reads half a file
    return FileResponse(path, media_type="image/png", headers={"Cache-Control": "public, max-age=86400"})
