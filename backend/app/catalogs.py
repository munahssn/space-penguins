"""
Catalogues for the "Is it new?" check: Gaia DR3 stars, SkyBoT solar-system bodies, SIMBAD objects.

Every catalogue position is moved to the date of the frame before matching, with that
catalogue's own proper motion:
- Gaia DR3 positions are at epoch 2016.0.
- SIMBAD positions are at epoch J2000 (SIMBAD moves every position with a known proper motion
  to J2000; WISE 0855 is at 08h55m16.5s there, not at its 2010 discovery position).
- SkyBoT computes where asteroids and comets are at the given time (as seen from the geocentre;
  SPHEREx is in low Earth orbit, the difference is negligible except for very near objects).

Answers are cached on disk by query (position, radius, and for SkyBoT the time), so a repeat click
costs nothing and the services are not asked twice. A service that fails is reported in
`warnings`, never as a crash.
"""
import hashlib
import json
import math

from .config import CACHE_DIR

GAIA_TAP = "https://gea.esac.esa.int/tap-server/tap"
# SIMBAD's main site (Strasbourg) first, then its official mirror at Harvard
SIMBAD_TAPS = ("https://simbad.cds.unistra.fr/simbad/sim-tap", "https://simbad.harvard.edu/simbad/sim-tap")
GAIA_EPOCH = 2016.0
SIMBAD_EPOCH = 2000.0
MAX_PM_ARCSEC_YR = 10.5            # Barnard's Star, the fastest star: sets the search margin
CAT_DIR = CACHE_DIR / "catalogs"
MAX_STARS = 2000                   # brightest Gaia stars returned for the overlay


def year_of(mjd):
    return 2000.0 + (mjd - 51544.5) / 365.25


def move(ra, dec, pmra, pmdec, years):
    """Shift a position by its proper motion (mas/yr; pmra includes cos(dec))."""
    pmra = 0.0 if pmra is None or not math.isfinite(pmra) else pmra
    pmdec = 0.0 if pmdec is None or not math.isfinite(pmdec) else pmdec
    d = dec + pmdec * years / 3.6e6
    r = ra + pmra * years / 3.6e6 / max(math.cos(math.radians(dec)), 1e-6)
    return r % 360.0, d


def sep_arcsec(ra1, dec1, ra2, dec2):
    """Angular distance in arcsec (haversine, fine at any scale)."""
    r1, d1, r2, d2 = map(math.radians, (ra1, dec1, ra2, dec2))
    a = math.sin((d2 - d1) / 2) ** 2 + math.cos(d1) * math.cos(d2) * math.sin((r2 - r1) / 2) ** 2
    return math.degrees(2 * math.asin(min(1.0, math.sqrt(a)))) * 3600


def _cached(kind, key, fetch):
    CAT_DIR.mkdir(parents=True, exist_ok=True)
    path = CAT_DIR / (kind + "-" + hashlib.sha1(json.dumps(key).encode()).hexdigest()[:20] + ".json")
    if path.exists():
        return json.loads(path.read_text())
    rows = fetch()
    path.write_text(json.dumps(rows))
    return rows


def _num(v):
    try:
        v = float(v)
        return v if math.isfinite(v) else None
    except (TypeError, ValueError):
        return None


def _tap(url, adql, maxrec):
    import pyvo
    return pyvo.dal.TAPService(url).run_sync(adql, maxrec=maxrec).to_table()


def gaia_cone(ra, dec, radius_deg, top=None):
    """Gaia DR3 sources within radius (positions at epoch 2016.0), brightest first."""
    def fetch():
        t = f"TOP {int(top)} " if top else ""
        q = (f"SELECT {t}source_id, ra, dec, pmra, pmdec, phot_g_mean_mag FROM gaiadr3.gaia_source "
             f"WHERE CONTAINS(POINT('ICRS', ra, dec), CIRCLE('ICRS', {ra:.6f}, {dec:.6f}, {radius_deg:.6f})) = 1 "
             f"ORDER BY phot_g_mean_mag")
        tab = _tap(GAIA_TAP, q, maxrec=top or 100000)
        cols = {c.lower(): c for c in tab.colnames}
        return [{"source_id": str(r[cols["source_id"]]), "ra": float(r[cols["ra"]]), "dec": float(r[cols["dec"]]),
                 "pmra": _num(r[cols["pmra"]]), "pmdec": _num(r[cols["pmdec"]]),
                 "gmag": _num(r[cols["phot_g_mean_mag"]])} for r in tab]
    return _cached("gaia", [round(ra, 4), round(dec, 4), round(radius_deg, 4), top], fetch)


def simbad_cone(ra, dec, radius_deg):
    """SIMBAD objects within radius: main_id, ra, dec (labelled J2000), pmra, pmdec, otype."""
    def fetch():
        q = ("SELECT main_id, ra, dec, pmra, pmdec, otype FROM basic "
             f"WHERE CONTAINS(POINT('ICRS', ra, dec), CIRCLE('ICRS', {ra:.6f}, {dec:.6f}, {radius_deg:.6f})) = 1")
        errors = []
        for url in SIMBAD_TAPS:
            try:
                tab = _tap(url, q, maxrec=10000)
                break
            except Exception as e:   # site down: try the mirror
                errors.append(f"{url.split('/')[2]}: {str(e)[:80]}")
        else:
            raise RuntimeError("; ".join(errors))
        cols = {c.lower(): c for c in tab.colnames}
        out = []
        for r in tab:
            rr, dd = _num(r[cols["ra"]]), _num(r[cols["dec"]])
            if rr is None or dd is None:
                continue
            out.append({"name": str(r[cols["main_id"]]).strip(), "ra": rr, "dec": dd,
                        "pmra": _num(r[cols["pmra"]]), "pmdec": _num(r[cols["pmdec"]]),
                        "otype": str(r[cols["otype"]]).strip()})
        return out
    return _cached("simbad", [round(ra, 4), round(dec, 4), round(radius_deg, 4)], fetch)


def skybot_cone(ra, dec, radius_deg, mjd):
    """Asteroids, comets and planets SkyBoT puts within radius at time mjd."""
    def fetch():
        import warnings

        import astropy.units as u
        from astropy.time import Time
        from astroquery.imcce import Skybot
        with warnings.catch_warnings():
            warnings.simplefilter("ignore")
            try:
                tab = Skybot.cone_search((ra, dec), radius_deg * u.deg, Time(mjd, format="mjd"),
                                         location="500", cache=False)
            except RuntimeError as e:   # older astroquery: "No solar system object was found"
                if "No solar system object" in str(e):
                    return []
                raise
        out = []
        for r in tab:
            out.append({"name": str(r["Name"]), "number": int(r["Number"]) if r["Number"] else None,
                        "type": str(r["Type"]), "ra": float(r["RA"].value if hasattr(r["RA"], "value") else r["RA"]),
                        "dec": float(r["DEC"].value if hasattr(r["DEC"], "value") else r["DEC"]),
                        "vmag": _num(r["V"].value if hasattr(r["V"], "value") else r["V"]),
                        "posunc_arcsec": _num(r["posunc"].value if hasattr(r["posunc"], "value") else r["posunc"])})
        return out
    return _cached("skybot", [round(ra, 4), round(dec, 4), round(radius_deg, 4), round(mjd, 3)], fetch)


def stars_at(stars, year):
    """Gaia stars moved from 2016.0 to `year`."""
    out = []
    for s in stars:
        r, d = move(s["ra"], s["dec"], s["pmra"], s["pmdec"], year - GAIA_EPOCH)
        out.append({**s, "ra": round(r, 7), "dec": round(d, 7)})
    return out


def simbad_distance(obj, ra, dec, year):
    """Distance (arcsec) between (ra, dec) and the SIMBAD object moved from J2000 to `year`."""
    r, d = move(obj["ra"], obj["dec"], obj["pmra"], obj["pmdec"], year - SIMBAD_EPOCH)
    return sep_arcsec(ra, dec, r, d)
