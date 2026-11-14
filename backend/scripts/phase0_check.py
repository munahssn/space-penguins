"""
Phase 0 sanity check, following IRSA's "Introduction to SPHEREx Spectral Images"
notebook with the same example position. If this works, IRSA access works and
our backend can be trusted with real data.

Run from backend/:
    python -m scripts.phase0_check
    python -m scripts.phase0_check --ra 133.768079 --dec -7.242922   # any other spot
"""
import argparse
import http.client
import time
import urllib.error
from collections import Counter

import astropy.units as u
import numpy as np
from astropy.coordinates import SkyCoord
from astropy.io import fits
from astropy.time import Time
from astropy.utils.data import conf
from astropy.wcs import WCS
from astroquery.ipac.irsa import Irsa

from app.spherex import ARTIFACT_MASK, BAD_MASK, COLLECTIONS, find_images

conf.remote_timeout = 120

ap = argparse.ArgumentParser()
ap.add_argument("--ra", type=float, default=304.693508808)   # notebook example
ap.add_argument("--dec", type=float, default=42.4436872991)
args = ap.parse_args()
coord = SkyCoord(args.ra, args.dec, unit="deg")


def step(n, text):
    print(f"\n[{n}] {text}")


# 1. SIA collections
step(1, "SPHEREx collections at IRSA")
cols = Irsa.list_collections(servicetype="SIA", filter="spherex")
print("   ", list(cols["collection"]))
missing = [c for c in COLLECTIONS if c not in list(cols["collection"])]
print("    we use:", COLLECTIONS, "| missing:", missing or "none")

# 2. Query images over the position
step(2, f"Images covering RA={args.ra:.4f} Dec={args.dec:.4f}")
t0 = time.time()
res = Irsa.query_sia(pos=(coord, 1 * u.arcsec), collection=COLLECTIONS)
print(f"    {len(res)} rows in {time.time() - t0:.1f}s  (notebook got 443 for its example)")
print("    per collection:", dict(Counter(str(c) for c in res["obs_collection"])))
print("    per detector:  ", dict(sorted(Counter(str(b) for b in res["energy_bandpassname"]).items())))
mjd = np.array(res["t_min"], dtype=float)
print(f"    time span: {Time(mjd.min(), format='mjd').iso[:10]} -> {Time(mjd.max(), format='mjd').iso[:10]}")

# 3. Our de-duplicated list (what the app actually uses)
step(3, "Our backend's list for D3 (duplicates across releases removed)")
rows = find_images(args.ra, args.dec, 0.05, "D3")
print(f"    {len(rows)} D3 images")
for r in rows[:3]:
    print("    ", Time(r["mjd"], format="mjd").iso[:16], r["uri"][:110], "...")

# 4. Download one cutout and look inside
step(4, "Download one cutout and inspect it")
url = rows[0]["uri"]
for attempt in range(3):
    try:
        with fits.open(url, memmap=False) as hdul:
            for h in hdul:
                h.data
        break
    except (TimeoutError, urllib.error.HTTPError, http.client.IncompleteRead) as e:
        if attempt == 2:
            raise
        print("    retrying:", e)
        time.sleep(10 * (attempt + 1))
hdul.info()

img_hdr = hdul["IMAGE"].header
print("    BUNIT:", img_hdr.get("BUNIT"), "| DETECTOR:", img_hdr.get("DETECTOR"),
      "| OBSID:", img_hdr.get("OBSID"), "| PSF_FWHM:", img_hdr.get("PSF_FWHM"))

wcs = WCS(img_hdr)
x, y = wcs.world_to_pixel(coord)
print(f"    target lands at pixel ({x:.1f}, {y:.1f}) of {hdul['IMAGE'].data.shape}")

# 5. Wavelength at the target pixel (needed for spectra later)
step(5, "Wavelength at the target (spectral WCS 'W')")
try:
    swcs = WCS(header=img_hdr, fobj=hdul, key="W")
    swcs.sip = None
    wl, bw = swcs.pixel_to_world(x, y)
    print(f"    wavelength = {wl:.4f}, bandwidth = {bw:.4f}")
except Exception as e:
    print("    could not read spectral WCS from cutout:", e)

# 6. Flags
step(6, "Flags in this cutout")
flags = hdul["FLAGS"].data.astype(np.int64)
print(f"    any flag set: {np.mean(flags != 0):.1%}   <- why we must NOT mask flags != 0")
print(f"    bad (masked): {np.mean((flags & BAD_MASK) != 0):.1%}")
print(f"    artifacts:    {np.mean((flags & ARTIFACT_MASK) != 0):.1%}")
print(f"    SOURCE bit:   {np.mean((flags & (1 << 21)) != 0):.1%}")

# 7. Zodi
step(7, "Zodiacal background (not pre-subtracted)")
im, zo = hdul["IMAGE"].data, hdul["ZODI"].data
print(f"    median IMAGE = {np.nanmedian(im):.3f}  median ZODI = {np.nanmedian(zo):.3f}  "
      f"median IMAGE-ZODI = {np.nanmedian(im - zo):.3f} MJy/sr")

print("\nPhase 0 check done. Next: python -m scripts.precache --only notebook-example")
