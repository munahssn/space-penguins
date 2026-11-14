"""Query parameter checks shared by the endpoints."""
from fastapi import HTTPException

from .config import DETECTORS, MODES


def check_query(ra, dec, fov, det):
    if not (0 <= ra < 360 and -90 <= dec <= 90):
        raise HTTPException(422, "ra must be 0-360, dec -90..90 (degrees)")
    if not (0.005 <= fov <= 0.5):
        raise HTTPException(422, "fov must be between 0.005 and 0.5 degrees")
    if det not in DETECTORS:
        raise HTTPException(422, f"det must be one of {sorted(DETECTORS)}")


def check_photometry_fov(fov, min_pixels, pixscale_deg):
    if fov / pixscale_deg < min_pixels:
        raise HTTPException(422, f"fov must be at least {min_pixels * pixscale_deg:.3f} degrees "
                                 "to measure brightness (room for the sky annulus)")


def check_mode(mode):
    if mode not in MODES:
        raise HTTPException(422, f"mode must be one of {sorted(MODES)}")


def check_wavelength(wmin, wmax):
    for name, v in (("wmin", wmin), ("wmax", wmax)):
        if v is not None and not (0 < v < 10):
            raise HTTPException(422, f"{name} is a wavelength in micrometres (SPHEREx covers 0.75-5.0)")
    if wmin is not None and wmax is not None and wmin > wmax:
        raise HTTPException(422, "wmin must not be larger than wmax")
