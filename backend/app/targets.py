"""
Challenge test targets.

Positions are catalogue positions at `epoch`, plus proper motion (mas/yr,
pmra already includes cos(dec)). Fast movers like Barnard's Star have moved
several arcminutes since J2000, so we shift them to the SPHEREx era before
querying, otherwise the target can fall off the cutout.

TODO (Phase 0): double-check each value against SIMBAD / Gaia DR3.
"""
import math

SPHEREX_EPOCH = 2025.9  # middle of the data so far

TARGETS = [
    {
        "id": "notebook-example", "name": "IRSA notebook example (Phase 0 test)",
        "ra": 304.693508808, "dec": 42.4436872991, "epoch": 2000.0,
        "pmra": 0.0, "pmdec": 0.0,
        "note": "position from IRSA's intro notebook, known to have lots of data",
    },
    {
        "id": "barnard", "name": "Barnard's Star",
        "ra": 269.452083, "dec": 4.693391, "epoch": 2000.0,
        "pmra": -801.6, "pmdec": 10362.4,
        "note": "fastest-moving star in the sky (~10.4\"/yr)",
    },
    {
        "id": "eps-indi-b", "name": "Epsilon Indi B",
        "ra": 331.043833, "dec": -56.782694, "epoch": 2000.0,
        "pmra": 3966.0, "pmdec": -2537.0,
        "note": "pair of brown dwarfs orbiting Epsilon Indi",
    },
    {
        "id": "wise0855", "name": "WISE 0855-0714",
        # The designation coordinates (08h55m10.83s -07d14m42.5s, as given in the challenge) are
        # its position in the 2010 WISE images (Luhman 2014), not J2000 or 2014. With epoch 2014
        # the predicted position was ~22" (3.6 px) off and /api/track could not find it.
        "ra": 133.795129, "dec": -7.245147, "epoch": 2010.4,
        "pmra": -8118.0, "pmdec": 673.0,
        "note": "coldest known brown dwarf, fast mover (~8\"/yr)",
    },
    {
        "id": "rw-aur", "name": "RW Aurigae",
        "ra": 76.956458, "dec": 30.401417, "epoch": 2000.0,
        "pmra": 0.0, "pmdec": 0.0,
        "note": "variable young star",
    },
    {
        "id": "r-dra", "name": "R Draconis",
        "ra": 248.167417, "dec": 66.755083, "epoch": 2000.0,
        "pmra": 0.0, "pmdec": 0.0,
        "note": "Mira variable star",
    },
]


def propagate(t, to_epoch=SPHEREX_EPOCH):
    """Linear proper-motion shift. Good enough for a few decades."""
    dt = to_epoch - t["epoch"]
    dec = t["dec"] + t["pmdec"] * dt / 3.6e6
    ra = t["ra"] + t["pmra"] * dt / 3.6e6 / math.cos(math.radians(t["dec"]))
    return ra % 360, dec


def catalog_match(ra, dec, radius_arcsec=30.0):
    """The test target within radius of (ra, dec) at the SPHEREx epoch, with its catalogue
    proper motion, or None. Only our own target list is searched: no external catalogue."""
    best = None
    for t in TARGETS:
        tra, tdec = propagate(t)
        dra = ((ra - tra + 180) % 360 - 180) * math.cos(math.radians(dec))
        d = math.hypot(dra, dec - tdec) * 3600
        if d <= radius_arcsec and (best is None or d < best[0]):
            best = (d, t)
    if best is None:
        return None
    t = best[1]
    return {"id": t["id"], "name": t["name"], "pmra": t["pmra"], "pmdec": t["pmdec"],
            "source": "targets.py", "separation_arcsec": round(best[0], 2)}


def targets_now():
    out = []
    for t in TARGETS:
        ra, dec = propagate(t)
        out.append({"id": t["id"], "name": t["name"], "ra": round(ra, 6),
                    "dec": round(dec, 6), "note": t["note"]})
    return out


SNAP_ARCSEC = 6.15  # one SPHEREx pixel


def snap_to_target(ra, dec, radius_arcsec=SNAP_ARCSEC):
    """(ra, dec) of the test target within one SPHEREx pixel of (ra, dec), exactly as /api/targets
    gives it; otherwise (ra, dec) unchanged. A click on a target's dot lands an arcsecond or so off
    its listed position, which would miss the precached data for that target and start new
    downloads; snapping makes the charts for the test targets answer from the cache."""
    best = None
    for t in targets_now():
        dra = ((ra - t["ra"] + 180) % 360 - 180) * math.cos(math.radians(dec))
        d = math.hypot(dra, dec - t["dec"]) * 3600
        if d <= radius_arcsec and (best is None or d < best[0]):
            best = (d, t)
    return (best[1]["ra"], best[1]["dec"]) if best else (ra, dec)
