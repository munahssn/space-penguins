"""Health check and the list of challenge test targets."""
from fastapi import APIRouter

from .. import jobs, spherex
from ..config import MOCK
from ..targets import targets_now

router = APIRouter()


@router.get("/api/health")
def health():
    return {"ok": True, "mock": MOCK, "release": spherex.RELEASE, **jobs.stats()}


@router.get("/api/targets")
def targets():
    return targets_now()
