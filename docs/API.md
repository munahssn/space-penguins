# API contract (v0)

Base URL in dev: `http://localhost:8000`. All responses are JSON.

Run the backend with `SPHEREX_MOCK=1` to get fake data in this exact shape for front end dev
---

## `GET /api/health`
```json
{ "ok": true, "mock": false, "release": "dr1+qr3" }
```

## `GET /api/targets`
The challenge's test objects, with positions already moved to the SPHEREx era.
```json
[
  { "id": "barnard", "name": "Barnard's Star", "ra": 269.446297, "dec": 4.767943,
    "note": "fastest-moving star in the sky (~10.4\"/yr)" }
]
```

## `GET /api/frames`
The main endpoint: one stacked image per survey pass (epoch), ready to blink.

| param | type | default | notes |
|---|---|---|---|
| `ra` | float | required | degrees |
| `dec` | float | required | degrees |
| `fov` | float | `0.1` | degrees, max `0.5` |
| `det` | string | `D3` | `D1`..`D6`, or `all` |

```json
{
  "query":   { "ra": 133.79, "dec": -7.25, "fov": 0.1, "det": "D3", "release": "dr1+qr3" },
  "grid":    { "width": 59, "height": 59, "pixscale_arcsec": 6.15 },
  "frames": [
    {
      "index": 0,
      "date": "2025-05-21",
      "mjd": 60816.4,
      "n_exposures": 14,
      "flagged_fraction": 0.04,
      "artifact_fraction": 0.01,
      "image": "data:image/png;base64,iVBORw0..."
    }
  ]
}
```
- Frames are sorted by time. Every frame uses the **same** brightness stretch, so the blink is fair.
- Images are north-up, east-left, target in the centre pixel.
- `image` is a PNG data URL: put it straight into `<img src>`.
- `flagged_fraction`: share of pixels hidden as bad (hot, cold, cosmic-ray transient, persistence, ...).
- `artifact_fraction`: share of pixels hit by ghosts, halos, streaks, crosstalk, bloom or snowballs. These are kept
  visible but can look like fake movers, so show this as a warning in the UI.

## `GET /api/diff`
Same params as `/api/frames`, plus:

| param | type | default | notes |
|---|---|---|---|
| `a` | int | `0` | frame index |
| `b` | int | last | frame index |
| `op` | string | `sub` | `sub` (b − a) or `add` (a + b) |

```json
{ "a": 0, "b": 2, "op": "sub", "image": "data:image/png;base64,..." }
```
In `sub` mode: red = brighter in b, blue = brighter in a. A moving source shows up as a red/blue pair.

## `GET /api/spectrum`  *(Phase 3, returns 501 until built)*
```json
{ "ra": 0, "dec": 0,
  "points": [ { "wavelength_um": 1.23, "flux": 45.1, "error": 3.2, "mjd": 60816.4, "det": "D2" } ] }
```

## `GET /api/catalog`  *(Phase 2, returns 501 until built)*
Gaia DR3 stars in the field.
```json
{ "stars": [ { "source_id": "4472832130942575872", "ra": 269.45, "dec": 4.69,
               "pmra": -801.6, "pmdec": 10362.4, "gmag": 8.19 } ] }
```

## Errors
```json
{ "detail": "No SPHEREx images cover this position" }
```
with HTTP 404 (nothing found), 422 (bad params) or 502 (IRSA failed).
