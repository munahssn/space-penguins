"""Name -> RA/Dec, so people can type "Barnard's Star" instead of numbers.

1. The challenge's test targets are answered locally (no network), including common spellings.
2. Any other name goes to CDS Sesame (SIMBAD/NED/VizieR). Sesame gives the J2000 position and the
   proper motion; we move the position to the SPHEREx epoch, otherwise fast movers would be
   minutes of arc away from where they are in the images.
Results are cached in memory."""
import re
import xml.etree.ElementTree as ET
from functools import lru_cache
from urllib.parse import quote

import requests
from fastapi import APIRouter, HTTPException

from ..config import MOCK
from ..targets import SPHEREX_EPOCH, TARGETS, propagate

router = APIRouter()

SESAME_URL = "https://cds.unistra.fr/cgi-bin/nph-sesame/-ox/SNV"  # redirects to a mirror
MAX_NAME_LEN = 100

# Extra spellings for the test targets (matching ignores case, spaces and punctuation).
ALIASES = {
    "barnard": ["Barnard's Star", "Barnards Star", "GJ 699", "V2500 Oph"],
    "eps-indi-b": ["Epsilon Indi B", "eps Ind B", "eps Indi B", "Epsilon Indi Ba", "Epsilon Indi Bab"],
    "wise0855": ["WISE 0855", "WISE 0855-0714", "WISE J0855-0714", "WISEA J085510.83-071442.5",
                 "WISE J085510.83-071442.5"],
    "rw-aur": ["RW Aur", "RW Aurigae", "V* RW Aur"],
    "r-dra": ["R Dra", "R Draconis", "V* R Dra"],
    "notebook-example": ["IRSA notebook example", "notebook example"],
}


def _norm(name):
    return re.sub(r"[^a-z0-9]+", "", name.lower())


def _local_index():
    index = {}
    for t in TARGETS:
        for label in [t["id"], t["name"], *ALIASES.get(t["id"], [])]:
            index[_norm(label)] = t
    return index


_LOCAL = _local_index()


def _answer(name, ra, dec, source, **extra):
    return {"name": name, "ra": round(ra, 6), "dec": round(dec, 6), "epoch": SPHEREX_EPOCH,
            "source": source, **extra}


@lru_cache(maxsize=512)
def _lookup_sesame(name):
    """Ask Sesame. Raises HTTPException (404 not found, 502 service problem); failures are not cached."""
    try:
        r = requests.get(f"{SESAME_URL}?{quote(name)}", timeout=20)
        r.raise_for_status()
    except requests.RequestException as e:
        raise HTTPException(502, f"Name service not reachable: {e}")
    try:
        root = ET.fromstring(r.content)
    except ET.ParseError:
        raise HTTPException(502, "Name service sent an answer we could not read")
    for res in root.iter("Resolver"):
        ra, dec = res.findtext("jradeg"), res.findtext("jdedeg")
        if ra and dec:
            pmra, pmde = res.findtext(".//pmRA"), res.findtext(".//pmDE")  # nested under <pm>
            return {
                "name": (res.findtext("oname") or name).replace("NAME ", "").lstrip("* ").strip() or name,
                "ra": float(ra), "dec": float(dec),
                "pmra": float(pmra) if pmra else 0.0, "pmdec": float(pmde) if pmde else 0.0,
            }
    raise HTTPException(404, f"No object called '{name}' was found")


@router.get("/api/resolve")
def resolve(name: str):
    name = " ".join(name.split())
    if not name:
        raise HTTPException(422, "name must not be empty")
    if len(name) > MAX_NAME_LEN:
        raise HTTPException(422, f"name must be at most {MAX_NAME_LEN} characters")

    t = _LOCAL.get(_norm(name))
    if t:
        ra, dec = propagate(t)
        return _answer(t["name"], ra, dec, "targets")
    if MOCK:
        raise HTTPException(404, f"No object called '{name}' (mock mode only knows the test targets)")

    s = _lookup_sesame(name)
    ra, dec = propagate({"ra": s["ra"], "dec": s["dec"], "epoch": 2000.0,
                         "pmra": s["pmra"], "pmdec": s["pmdec"]})
    return _answer(s["name"], ra, dec, "sesame", ra_j2000=round(s["ra"], 6), dec_j2000=round(s["dec"], 6),
                   pmra=s["pmra"], pmdec=s["pmdec"])
