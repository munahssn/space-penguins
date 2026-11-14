"""The "Is it new?" check and the Gaia overlay.

GET /api/context: is the thing at (ra, dec) in a frame taken at mjd a known star, a known
asteroid/comet, some other known object, or unexplained? Fixed rules, no LLM:
every catalogue is moved to the frame's date, then the closest object within MATCH_ARCSEC wins;
if several are equally close (same object in two catalogues), the order is Gaia, SkyBoT, SIMBAD.

GET /api/catalog: Gaia DR3 stars in the field, moved to a date, for the overlay.
"""
import math

from fastapi import APIRouter, HTTPException

from .. import catalogs
from ..config import MOCK
from ..spherex import PIXSCALE_DEG
from ..targets import TARGETS, propagate

router = APIRouter()

MATCH_ARCSEC = 2 * PIXSCALE_DEG * 3600   # ~2 SPHEREx pixels = 12.3"
TIE_ARCSEC = 0.5                         # this close to each other: the same object, use the rule order
ARTIFACT_WARN = 0.05                     # artifact_fraction above this -> "may be an artifact"
DEFAULT_YEAR = 2025.9                    # /api/catalog without mjd


def _check(ra, dec, fov):
    if not (0 <= ra < 360 and -90 <= dec <= 90):
        raise HTTPException(422, "ra must be 0-360, dec -90..90 (degrees)")
    if not (0.005 <= fov <= 0.5):
        raise HTTPException(422, "fov must be between 0.005 and 0.5 degrees")


def _field_radius(fov):
    return fov / 2 * math.sqrt(2)   # circle around the square field


def _margin(year, epoch):
    """Search radius (deg) that catches anything able to reach the point between epoch and year."""
    return catalogs.MAX_PM_ARCSEC_YR / 3600 * abs(year - epoch) + MATCH_ARCSEC / 3600


# ---------- mock: the test targets stand in for the catalogues ----------

def _mock_catalogs(ra, dec, fov, year):
    stars, other = [], []
    for t in TARGETS:
        tra, tdec = propagate(t, year)
        row = {"ra": round(tra, 7), "dec": round(tdec, 7), "pmra": t["pmra"], "pmdec": t["pmdec"]}
        if t["id"] == "wise0855":   # not in Gaia, like the real one
            other.append({**row, "name": t["name"], "otype": "BD*"})
        else:
            stars.append({**row, "source_id": "mock-" + t["id"], "gmag": 10.0, "name": t["name"]})
    near = lambda o: catalogs.sep_arcsec(ra, dec, o["ra"], o["dec"]) <= _field_radius(fov) * 3600  # noqa: E731
    return [s for s in stars if near(s)], [o for o in other if near(o)]


# ---------- endpoints ----------

@router.get("/api/catalog")
def catalog(ra: float, dec: float, fov: float = 0.1, mjd: float | None = None):
    """Gaia DR3 stars in the field, moved to the date (default 2025.9), brightest first."""
    _check(ra, dec, fov)
    year = catalogs.year_of(mjd) if mjd is not None else DEFAULT_YEAR
    if MOCK:
        stars, _ = _mock_catalogs(ra, dec, fov, year)
    else:
        try:
            raw = catalogs.gaia_cone(ra, dec, _field_radius(fov) + _margin(year, catalogs.GAIA_EPOCH),
                                     top=catalogs.MAX_STARS)
        except Exception as e:
            raise HTTPException(502, f"Gaia request failed: {e}")
        stars = [s for s in catalogs.stars_at(raw, year)
                 if catalogs.sep_arcsec(ra, dec, s["ra"], s["dec"]) <= _field_radius(fov) * 3600]
    return {"epoch": round(year, 3), "source": "Gaia DR3", "stars": stars}


@router.get("/api/context")
def context(ra: float, dec: float, mjd: float, fov: float = 0.1,
            artifact_fraction: float | None = None):
    """Is the thing at (ra, dec), in a frame taken at mjd, already known?

    fov sets how much of the field `stars` and `asteroids` cover (for drawing them);
    artifact_fraction is the frame's value from /api/frames, for the artifact warning."""
    _check(ra, dec, fov)
    if not (40000 < mjd < 80000):
        raise HTTPException(422, "mjd must be a Modified Julian Date, e.g. 61000.5")
    year = catalogs.year_of(mjd)
    warnings, cands = [], []
    if artifact_fraction is not None and artifact_fraction > ARTIFACT_WARN:
        warnings.append("may be an artifact")

    if MOCK:
        stars, others = _mock_catalogs(ra, dec, fov, year)
        asteroids = []
        for s in stars:
            d = catalogs.sep_arcsec(ra, dec, s["ra"], s["dec"])
            cands.append((d, 0, "known_star", {"name": s["name"], "type": "star", "source": "Gaia DR3 (mock)"}))
        for o in others:
            d = catalogs.sep_arcsec(ra, dec, o["ra"], o["dec"])
            cands.append((d, 2, "known_other", {"name": o["name"], "type": o["otype"], "source": "SIMBAD (mock)"}))
    else:
        # 1. Gaia: the field for the overlay, plus every star whose 2016 position could have moved here
        stars = []
        try:
            near = catalogs.stars_at(catalogs.gaia_cone(ra, dec, _margin(year, catalogs.GAIA_EPOCH)), year)
            field = catalogs.stars_at(catalogs.gaia_cone(ra, dec, _field_radius(fov) + _margin(year, catalogs.GAIA_EPOCH),
                                                         top=catalogs.MAX_STARS), year)
            stars = [s for s in field if catalogs.sep_arcsec(ra, dec, s["ra"], s["dec"]) <= _field_radius(fov) * 3600]
            for s in near:
                d = catalogs.sep_arcsec(ra, dec, s["ra"], s["dec"])
                cands.append((d, 0, "known_star", {"name": f"Gaia DR3 {s['source_id']}", "type": "star",
                                                   "source": "Gaia DR3", "gmag": s["gmag"]}))
        except Exception as e:
            warnings.append(f"Gaia unavailable: {str(e)[:120]}")
        # 2. SkyBoT: where asteroids and comets were at that moment
        asteroids = []
        try:
            asteroids = catalogs.skybot_cone(ra, dec, _field_radius(fov), mjd)
            for a in asteroids:
                d = catalogs.sep_arcsec(ra, dec, a["ra"], a["dec"])
                unc = a.get("posunc_arcsec") or 0.0
                cands.append((max(0.0, d - unc), 1, "known_asteroid",
                              {"name": a["name"], "type": a["type"], "source": "SkyBoT", "vmag": a["vmag"]}))
        except Exception as e:
            warnings.append(f"SkyBoT unavailable: {str(e)[:120]}")
        # 3. SIMBAD with its own proper motion
        try:
            for o in catalogs.simbad_cone(ra, dec, _margin(year, catalogs.SIMBAD_EPOCH)):
                d = catalogs.simbad_distance(o, ra, dec, year)
                cands.append((d, 2, "known_other", {"name": o["name"], "type": o["otype"], "source": "SIMBAD"}))
        except Exception as e:
            warnings.append(f"SIMBAD unavailable: {str(e)[:120]}")

    hits = sorted((c for c in cands if c[0] <= MATCH_ARCSEC), key=lambda c: c[0])
    if hits:
        close = [c for c in hits if c[0] <= hits[0][0] + TIE_ARCSEC]   # about equally close: rule order
        best = min(close, key=lambda c: c[1])
        verdict, match = best[2], {**best[3], "distance_arcsec": round(best[0], 2)}
    else:
        failed = any("unavailable" in w for w in warnings)
        verdict, match = ("unknown" if failed else "unexplained"), None
    return {"query": {"ra": ra, "dec": dec, "mjd": mjd, "fov": fov, "epoch": round(year, 3)},
            "verdict": verdict, "match": match,
            "other_matches": [{**c[3], "distance_arcsec": round(c[0], 2), "verdict": c[2]} for c in hits[1:6]],
            "match_radius_arcsec": round(MATCH_ARCSEC, 2),
            "stars": stars, "asteroids": asteroids, "warnings": warnings}
