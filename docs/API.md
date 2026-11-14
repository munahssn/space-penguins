# API contract (v0)

Base URL in dev: `http://localhost:8000`. All responses are JSON.

Run the backend with `SPHEREX_MOCK=1` to get fake data in this exact shape for front end dev
---

## `GET /api/health`
```json
{ "ok": true, "mock": false, "release": "dr1+qr3", "jobs_running": 0, "jobs_queued": 0 }
```
`jobs_running` / `jobs_queued`: downloads in progress and waiting (see "New spots take a while" below).

## `GET /api/targets`
The challenge's test objects, with positions already moved to the SPHEREx era.
```json
[
  { "id": "barnard", "name": "Barnard's Star", "ra": 269.446297, "dec": 4.767943,
    "note": "fastest-moving star in the sky (~10.4\"/yr)" }
]
```

## `GET /api/resolve?name=`
Turn a name into coordinates, so people can type "Barnard's Star" instead of RA/Dec.
```json
{ "name": "Barnard's Star", "ra": 269.446297, "dec": 4.767943, "epoch": 2025.9, "source": "targets" }
```
- `ra`/`dec` are degrees **already moved to the SPHEREx era** (epoch 2025.9) with the object's proper motion,
  so you can pass them straight to `/api/frames`.
- The 5 challenge targets (and common spellings such as `WISE 0855`, `eps Ind B`, `R Dra`) are answered
  locally and instantly: `source: "targets"`.
- Any other name is looked up at CDS Sesame (SIMBAD/NED/VizieR), takes about 2 s, and is cached:
  `source: "sesame"`, plus `ra_j2000`, `dec_j2000`, `pmra`, `pmdec` (mas/yr). An unknown name can take ~8 s to fail.
- Errors: 404 name not found, 422 empty or over-long name, 502 name service not reachable.
- In mock mode only the test targets resolve (no network).

## `GET /api/frames`
The main endpoint: one stacked image per survey pass (epoch), ready to blink.

| param | type | default | notes |
|---|---|---|---|
| `ra` | float | required | degrees |
| `dec` | float | required | degrees |
| `fov` | float | `0.1` | degrees, max `0.5` |
| `det` | string | `D3` | `D1`..`D6`, or `all` |
| `wmin` | float | none | micrometres; use only exposures that saw the target at `>= wmin` |
| `wmax` | float | none | micrometres; use only exposures that saw the target at `<= wmax` |

```json
{
  "query":   { "ra": 133.79, "dec": -7.25, "fov": 0.1, "det": "D3", "wmin": null, "wmax": null,
               "release": "dr1+qr3" },
  "grid":    { "width": 59, "height": 59, "pixscale_arcsec": 6.15 },
  "frames": [
    {
      "index": 0,
      "date": "2025-05-21",
      "mjd": 60816.4,
      "n_exposures": 14,
      "n_exposures_total": 14,
      "wavelength_um": 1.95,
      "wavelength_min_um": 1.66,
      "wavelength_max_um": 2.40,
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
- Wavelength filter: SPHEREx has a linear variable filter, so every exposure sees the target at a
  different wavelength (`D1` 0.75-1.11, `D2` 1.11-1.64, `D3` 1.64-2.42, `D4` 2.42-3.82, `D5` 3.82-4.42,
  `D6` 4.42-5.00 um). `wmin`/`wmax` keep only the exposures inside the range; either can be given alone.
  - `n_exposures`: exposures stacked into this frame. `n_exposures_total`: exposures in that survey pass
    before the filter (equal when no filter is set).
  - `wavelength_um`: median wavelength at the target over the stacked exposures, with
    `wavelength_min_um` / `wavelength_max_um`. `null` if the wavelength could not be read.
  - A survey pass with no exposure in range has no frame, so a narrow range can return fewer frames.
    If no pass is left: 404.
  - Exposures are cached per position, so changing `wmin`/`wmax` does not download anything again.
- `flagged_fraction`: share of pixels hidden as bad (hot, cold, cosmic-ray transient, persistence, ...).
- `artifact_fraction`: share of pixels hit by ghosts, halos, streaks, crosstalk, bloom or snowballs. These are kept
  visible but can look like fake movers, so show this as a warning in the UI.

### New spots take a while: HTTP 202
The first request for a position, fov and detector downloads its exposures (about 20 s with the S3 reader,
more if IRSA is slow). Instead of waiting, `/api/frames` and `/api/diff` answer **202** and start a background job:

```json
{ "status": "queued", "position": 2 }
{ "status": "processing", "done": 12, "total": 45 }
```
- The response also has `Retry-After: 2`. **Ask the same URL again every ~2 s** until you get 200 (or an error).
- Identical requests share one job. At most 2 jobs run at once, the rest wait in a queue (`position` 1 = next).
- `wmin`/`wmax` are not part of the job: they only filter data that is already downloaded.
- A failed job is reported once as an error (404 no data, 502 IRSA failed) on the next poll; asking again retries.
- 503 if too many requests are waiting. Positions that are already cached, and mock mode, answer 200 at once.
- Backend note: job state is in memory, so run **one** uvicorn worker.

## `GET /api/diff`
Same params as `/api/frames` (including `wmin`/`wmax`; also answers 202 while the data downloads), plus:

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
with HTTP 404 (nothing found), 422 (bad params), 502 (IRSA failed) or 503 (too many requests waiting, try again).
