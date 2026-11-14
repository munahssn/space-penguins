"""
Fake data in the real API shape, so the frontend can be built without IRSA.
A few static stars plus one source that moves between epochs.
"""
import numpy as np

from .spherex import PIXSCALE_DEG


def mock_stacks(ra, dec, fov, det):
    n = max(8, int(np.ceil(fov / PIXSCALE_DEG)))
    rng = np.random.default_rng(int(abs(ra * 1000 + dec * 10)) % 2**32)
    yy, xx = np.mgrid[0:n, 0:n]

    def star(x, y, flux, sigma=1.1):
        return flux * np.exp(-((xx - x) ** 2 + (yy - y) ** 2) / (2 * sigma**2))

    base = np.zeros((n, n))
    for _ in range(max(5, n // 3)):
        base += star(rng.uniform(0, n), rng.uniform(0, n), rng.uniform(5, 80))

    dates = [("2025-05-21", 60816.4), ("2025-11-18", 60997.6), ("2026-05-20", 61180.3)]
    stacks, meta = [], []
    c = n / 2 - 0.5
    for k, (d, mjd) in enumerate(dates):
        img = base + star(c + 1.5 * k, c + 0.4 * k, 60)  # the mover
        img += rng.normal(0, 1.5, (n, n))
        stacks.append(img)
        meta.append({"date": d, "mjd": mjd, "n_exposures": int(rng.integers(8, 20)),
                     "flagged_fraction": round(float(rng.uniform(0, 0.08)), 3),
                     "artifact_fraction": round(float(rng.uniform(0, 0.03)), 3)})
    grid = {"width": n, "height": n, "pixscale_arcsec": PIXSCALE_DEG * 3600}
    return stacks, meta, grid
