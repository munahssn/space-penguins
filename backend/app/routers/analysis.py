"""Spectrum and light curve of whatever sits at (ra, dec).

Both read the same cached exposures as /api/frames, so a position that was
already blinked with the same fov and det answers at once. A new position
answers 202 while it downloads (see jobs.py); poll the same URL.
Also the motion track and the infrared colour image."""
from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import JSONResponse

from .. import jobs, spherex
from ..cache import get_exposures
from ..config import MOCK
from ..targets import catalog_match
from ..validation import check_photometry_fov, check_query, check_wavelength
from .images import image_url

router = APIRouter()


def _exposures(ra, dec, fov, det, wmin, wmax):
    """The cached exposures, or a 202 response while they download."""
    check_query(ra, dec, fov, det)
    check_wavelength(wmin, wmax)
    check_photometry_fov(fov, spherex.MIN_PHOT_PIXELS, spherex.PIXSCALE_DEG)
    info = jobs.pending(ra, dec, fov, det)
    if info:
        return None, JSONResponse(status_code=202, content=info, headers={"Retry-After": "2"})
    return get_exposures(ra, dec, fov, det), None


def _query(ra, dec, fov, det, wmin, wmax):
    return {"ra": ra, "dec": dec, "fov": fov, "det": det, "wmin": wmin, "wmax": wmax,
            "release": "mock" if MOCK else spherex.RELEASE}


def _pending(info):
    return JSONResponse(status_code=202, content=info, headers={"Retry-After": "2"})


@router.get("/api/spectrum")
def spectrum(ra: float, dec: float, fov: float = 0.05, det: str = "all",
             wmin: float | None = None, wmax: float | None = None):
    """Brightness against wavelength: one point per exposure."""
    e, pending = _exposures(ra, dec, fov, det, wmin, wmax)
    if pending:
        return pending
    points, skipped = spherex.spectrum_points(e, wmin, wmax)
    if not points:
        raise HTTPException(404, "No exposure could be measured at this position: " + (
            "the source saturates the detector" if skipped else "nothing in the wavelength range"))
    return {"query": _query(ra, dec, fov, det, wmin, wmax), "ra": ra, "dec": dec,
            "flux_unit": "mJy", "n_skipped": skipped, "points": points}


@router.get("/api/lightcurve")
def lightcurve(ra: float, dec: float, det: str = "D3", fov: float = 0.05,
               wmin: float | None = None, wmax: float | None = None):
    """Brightness against time: one point per survey pass."""
    e, pending = _exposures(ra, dec, fov, det, wmin, wmax)
    if pending:
        return pending
    points, method = spherex.lightcurve_points(e, wmin, wmax)
    if not points:
        raise HTTPException(404, "No exposure could be measured at this position "
                                 "(saturated with too small a fov, or nothing in the wavelength range)")
    return {"query": _query(ra, dec, fov, det, wmin, wmax), "ra": ra, "dec": dec,
            "flux_unit": "mJy", "method": method, "points": points}


@router.get("/api/track")
def track(ra: float, dec: float, det: str = "D6", fov: float = 0.05):
    """Where the target is in each survey pass, and the proper motion fitted to that."""
    check_query(ra, dec, fov, det)
    check_photometry_fov(fov, spherex.MIN_TRACK_PIXELS, spherex.PIXSCALE_DEG)
    info = jobs.pending(ra, dec, fov, det)
    if info:
        return _pending(info)
    e = get_exposures(ra, dec, fov, det)
    measured = spherex.track_points(e, ra, dec, fov)
    fit = spherex.fit_proper_motion(measured)
    cat = catalog_match(ra, dec)
    compare = None
    if fit and cat:
        compare = {}
        for k in ("pmra", "pmdec"):
            d = fit[k] - cat[k]
            compare[k + "_diff"] = round(d, 1)
            compare[k + "_sigma"] = round(abs(d) / fit[k + "_err"], 1) if fit[k + "_err"] > 0 else None
    return {"query": {"ra": ra, "dec": dec, "fov": fov, "det": det,
                      "release": "mock" if MOCK else spherex.RELEASE},
            "unit": "mas/yr", "measured": measured, "fit": fit,
            "catalog_pm": cat, "compare": compare}


@router.get("/api/rgb")
def rgb(ra: float, dec: float, fov: float = 0.1,
        images: str = Query("url", pattern="^(inline|url)$")):
    """Infrared colour image: D1 blue, D3 green, D6 red, every exposure of each stacked."""
    check_query(ra, dec, fov, "all")
    infos = {d: jobs.pending(ra, dec, fov, d) for d in spherex.RGB_CHANNELS.values()}
    waiting = {d: i for d, i in infos.items() if i}
    if waiting:
        processing = [i for i in waiting.values() if i["status"] == "processing"]
        out = {"status": "processing" if processing else "queued",
               "done": sum(i.get("done", 0) for i in processing),
               "total": sum(i.get("total", 0) for i in processing),
               "detectors": waiting}
        if not processing:
            out["position"] = min(i["position"] for i in waiting.values())
        return _pending(out)
    exps = {c: get_exposures(ra, dec, fov, d) for c, d in spherex.RGB_CHANNELS.items()}
    res = {"query": {"ra": ra, "dec": dec, "fov": fov, "release": "mock" if MOCK else spherex.RELEASE},
           "channels": dict(spherex.RGB_CHANNELS),
           "n_exposures": {c: len(e["mjds"]) for c, e in exps.items()}}
    if images == "url":
        res["url"] = image_url("c", ra, dec, fov, "all", None, None)
    else:
        ch = {c: spherex.deep_stack(e) for c, e in exps.items()}
        res["image"] = spherex._data_url(spherex.colour_image(ch["red"], ch["green"], ch["blue"]))
    return res
