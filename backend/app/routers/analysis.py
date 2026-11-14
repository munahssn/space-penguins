"""Spectrum, light curve, motion track and colour image (not built yet)."""
from fastapi import APIRouter, HTTPException

router = APIRouter()


@router.get("/api/spectrum")
def spectrum(ra: float, dec: float):
    raise HTTPException(501, "Spectrum extraction comes in Phase 3")
