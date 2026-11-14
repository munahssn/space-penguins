"""Spectrum and light curve of whatever sits at (ra, dec).

Both read the same cached exposures as /api/frames, so a position that was
already blinked with the same fov and det answers at once. A new position
answers 202 while it downloads (see jobs.py); poll the same URL.
Motion track and colour image are not built yet."""
from fastapi import APIRouter, HTTPException
from fastapi.responses import JSONResponse

from .. import jobs, spherex
from ..cache import get_exposures
from ..config import MOCK
from ..validation import check_photometry_fov, check_query, check_wavelength

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
