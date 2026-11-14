"""Catalog context for the "Is it new?" check (not built yet)."""
from fastapi import APIRouter, HTTPException

router = APIRouter()


@router.get("/api/catalog")
def catalog(ra: float, dec: float, r: float = 0.05):
    raise HTTPException(501, "Gaia overlay comes in Phase 2")
