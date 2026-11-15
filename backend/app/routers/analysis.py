"""Spectrum and light curve of whatever sits at (ra, dec).

Both read the same cached exposures as /api/frames, so a position that was
already blinked with the same fov and det answers at once. A new position
answers 202 while it downloads (see jobs.py); poll the same URL.
Also the motion track and the infrared colour image."""
from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import JSONResponse

from .. import jobs, spherex
from ..cache import field_covering, get_exposures, view_at
from ..config import MOCK
from ..cache import is_cached
from ..targets import catalog_match
from .context import catalog_motion
from ..validation import check_photometry_fov, check_query, check_wavelength
from .images import image_url

router = APIRouter()


TRACK_DETECTORS = ("D6", "D5", "D4", "D3", "D2", "D1")   # track without det: first one already downloaded


def exposures_at(ra, dec, fov, det):
    """Exposures for a measurement at (ra, dec): cut out of an already downloaded field that
    contains the point if there is one (instant), else the usual download (202 while it runs).
    Returns (exposures, None) or (None, 202 response)."""
    v = view_at(ra, dec, fov, det)
    if v:
        return v, None
    info = jobs.pending(ra, dec, fov, det)
    if info:
        return None, _pending(info)
    return get_exposures(ra, dec, fov, det), None


def track_detector(ra, dec, fov, det):
    """The detector to track in: `det` if given; else the first of TRACK_DETECTORS whose data
    already covers the point; else D6 (brown dwarfs are brightest there)."""
    if det:
        return det
    for d in TRACK_DETECTORS:
        if is_cached(ra, dec, fov, d) or field_covering(ra, dec, fov, d):
            return d
    return "D6"


def _exposures(ra, dec, fov, det, wmin, wmax):
    """The exposures, or a 202 response while they download."""
    check_query(ra, dec, fov, det)
    check_wavelength(wmin, wmax)
    check_photometry_fov(fov, spherex.MIN_PHOT_PIXELS, spherex.PIXSCALE_DEG)
    return exposures_at(ra, dec, fov, det)


def _query(ra, dec, fov, det, wmin, wmax, e=None):
    q = {"ra": ra, "dec": dec, "fov": fov, "det": det, "wmin": wmin, "wmax": wmax,
         "release": "mock" if MOCK else spherex.RELEASE}
    if e and "field" in e:
        q["from_field"] = e["field"]   # measured inside this already downloaded field
    return q


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
    return {"query": _query(ra, dec, fov, det, wmin, wmax, e), "ra": ra, "dec": dec,
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
    return {"query": _query(ra, dec, fov, det, wmin, wmax, e), "ra": ra, "dec": dec,
            "flux_unit": "mJy", "method": method, "points": points}


@router.get("/api/track")
def track(ra: float, dec: float, det: str | None = None, fov: float = 0.05):
    """Where the target is in each survey pass, and the proper motion fitted to that.
    Without det: a detector whose data already covers the point, else D6."""
    check_query(ra, dec, fov, det or "D6")
    check_photometry_fov(fov, spherex.MIN_TRACK_PIXELS, spherex.PIXSCALE_DEG)
    det = track_detector(ra, dec, fov, det)
    e, pending = exposures_at(ra, dec, fov, det)
    if pending:
        return pending
    measured = spherex.track_points(e, ra, dec, fov)
    fit = spherex.fit_proper_motion(measured)
    # catalogue motion: our curated test targets first, else the Gaia/SIMBAD object at the point
    warnings = []
    cat = catalog_match(ra, dec) or catalog_motion(ra, dec, sum(e["mjds"]) / len(e["mjds"]), warnings)
    compare = None
    if fit and cat:
        compare = {}
        for k in ("pmra", "pmdec"):
            d = fit[k] - cat[k]
            compare[k + "_diff"] = round(d, 1)
            compare[k + "_sigma"] = round(abs(d) / fit[k + "_err"], 1) if fit[k + "_err"] > 0 else None
    return {"query": _query(ra, dec, fov, det, None, None, e),
            "unit": "mas/yr", "measured": measured, "fit": fit,
            "catalog_pm": cat, "compare": compare, "warnings": warnings}


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
