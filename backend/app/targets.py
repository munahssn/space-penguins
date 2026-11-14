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
        "ra": 133.795129, "dec": -7.245147, "epoch": 2014.0,
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


def targets_now():
    out = []
    for t in TARGETS:
        ra, dec = propagate(t)
        out.append({"id": t["id"], "name": t["name"], "ra": round(ra, 6),
                    "dec": round(dec, 6), "note": t["note"]})
    return out
