"""
Fake data in the real shape, so the frontend can be built without IRSA.
A few static stars plus one source that moves between survey passes.
Like the real pipeline it produces single exposures, each at its own wavelength.
"""
import numpy as np

from .spherex import DET_RANGE_UM, PIXSCALE_DEG


def mock_exposures(ra, dec, fov, det):
    n = max(8, int(np.ceil(fov / PIXSCALE_DEG)))
    rng = np.random.default_rng(int(abs(ra * 1000 + dec * 10)) % 2**32)
    yy, xx = np.mgrid[0:n, 0:n]

    def star(x, y, flux, sigma=1.1):
        return flux * np.exp(-((xx - x) ** 2 + (yy - y) ** 2) / (2 * sigma**2))

    base = np.zeros((n, n))
    for _ in range(max(5, n // 3)):
        base += star(rng.uniform(0, n), rng.uniform(0, n), rng.uniform(5, 80))

    passes = [60816.4, 60997.6, 61180.3]  # 2025-05-21, 2025-11-18, 2026-05-20
    dets = sorted(DET_RANGE_UM) if det == "all" else [det]
    mjds, bands, results = [], [], []
    c = n / 2 - 0.5
    for k, mjd0 in enumerate(passes):
        sky = base + star(c + 1.5 * k, c + 0.4 * k, 60)  # the mover
        for j in range(int(rng.integers(8, 20))):
            band = dets[j % len(dets)]
            mjds.append(round(mjd0 + 0.07 * j, 3))
            bands.append(band)
            results.append((sky + rng.normal(0, 4, (n, n)),
                            float(rng.uniform(0, 0.08)), float(rng.uniform(0, 0.03)),
                            float(rng.uniform(*DET_RANGE_UM[band]))))
    grid = {"width": n, "height": n, "pixscale_arcsec": PIXSCALE_DEG * 3600}
    return {"mjds": mjds, "bands": bands, "results": results, "grid": grid}
