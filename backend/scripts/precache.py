"""
Phase 0 job: fetch all 5 test targets from IRSA and save them in backend/cache/.
Also our first real look at the data. The demo then works even if IRSA is slow.

Run from backend/:
    python -m scripts.precache                 # all targets, D3, fov 0.1
    python -m scripts.precache --det all --fov 0.2
"""
import argparse
import time

from app.main import get_stacks
from app.targets import targets_now

ap = argparse.ArgumentParser()
ap.add_argument("--fov", type=float, default=0.1)
ap.add_argument("--det", default="D3")
ap.add_argument("--only", help="target id, e.g. wise0855")
args = ap.parse_args()

for t in targets_now():
    if args.only and t["id"] != args.only:
        continue
    print(f"\n== {t['name']}  RA={t['ra']:.5f}  Dec={t['dec']:.5f}")
    t0 = time.time()
    try:
        stacks, meta, grid = get_stacks(t["ra"], t["dec"], args.fov, args.det)
        print(f"   {len(stacks)} epochs, grid {grid['width']}x{grid['height']}, "
              f"{time.time() - t0:.0f}s")
        for m in meta:
            print(f"   {m['date']}  n={m['n_exposures']:3d}  flagged={m['flagged_fraction']:.1%}")
    except Exception as e:
        print(f"   FAILED: {e}")
