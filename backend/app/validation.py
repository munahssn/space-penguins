"""Query parameter checks shared by the endpoints."""
from fastapi import HTTPException

from .config import DETECTORS


def check_query(ra, dec, fov, det):
    if not (0 <= ra < 360 and -90 <= dec <= 90):
        raise HTTPException(422, "ra must be 0-360, dec -90..90 (degrees)")
    if not (0.005 <= fov <= 0.5):
        raise HTTPException(422, "fov must be between 0.005 and 0.5 degrees")
    if det not in DETECTORS:
        raise HTTPException(422, f"det must be one of {sorted(DETECTORS)}")
