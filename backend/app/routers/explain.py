"""GET /api/explain: the "Is it new?" verdict in plain words."""
from fastapi import APIRouter, HTTPException

from ..explain import explain as make_text
from ..explain import facts_from
from .analysis import exposures_at, track, track_detector
from .context import context

router = APIRouter()


@router.get("/api/explain")
def explain(ra: float, dec: float, mjd: float, artifact_fraction: float | None = None,
            motion: bool = True, det: str | None = None, fov: float = 0.05):
    """Explanation of what sits at (ra, dec) in the frame taken at mjd.

    Uses /api/context and, if motion=true, the motion track at (ra, dec) (detector chosen as
    in /api/track: data already covering the point first, else D6).
    Always answers 200: if the data for the track is still downloading, the text says so
    (facts.motion_status = "pending") and the download is started; ask again later."""
    ctx = context(ra=ra, dec=dec, mjd=mjd, fov=0.1, artifact_fraction=artifact_fraction)
    tr, status = None, "not_requested"
    if motion:
        det = track_detector(ra, dec, fov, det)
        try:
            _, pending = exposures_at(ra, dec, fov, det)
        except HTTPException:   # failed download or full queue: explain without motion
            pending, status = None, "unavailable"
        if pending:
            status = "pending"
        elif status != "unavailable":
            tr, status = track(ra=ra, dec=dec, det=det, fov=fov), "measured"
    f = facts_from(ctx, tr, status)
    return {**make_text(f), "facts": f}
