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
| `mode` | string | `epoch` | `epoch`: one stacked frame per survey pass. `exposure`: one frame per single exposure |
| `images` | string | `inline` | `inline`: each frame has `image`, a base64 PNG data URL (large JSON). `url`: each frame has `url` instead, a short link to the PNG (see `GET /img/...` below). Use `url` with `mode=exposure`: up to 400 frames |

```json
{
  "query":   { "ra": 133.79, "dec": -7.25, "fov": 0.1, "det": "D3", "wmin": null, "wmax": null,
               "mode": "epoch", "release": "dr1+qr3" },
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
- Exposure mode (`mode=exposure`, "asteroid mode"): one frame per single exposure, in time order.
  Use it for fast movers, which shift within one survey pass and get smeared by stacking.
  - Every exposure is at a different wavelength, so each frame is normalised to its own background
    (median subtracted, divided by its noise). Pixel values are in units of background sigma.
  - Frames have the same fields as in epoch mode, with `n_exposures` = 1, plus `time`
    (`"2025-11-07T05:47:02"`) and `det` (`"D3"`). `mjd` has 5 decimals.
  - `wmin`/`wmax` work the same way. At most 400 frames are returned (the earliest ones).
  - Frames are noisier than in epoch mode and there are many more of them.
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
Same params as `/api/frames` (including `wmin`/`wmax` and `mode`, so `a`/`b` index the same frames;
also answers 202 while the data downloads), plus:

| param | type | default | notes |
|---|---|---|---|
| `a` | int | `0` | frame index |
| `b` | int | last | frame index |
| `op` | string | `sub` | `sub` (b − a) or `add` (a + b) |

```json
{ "a": 0, "b": 2, "op": "sub", "image": "data:image/png;base64,..." }
```
In `sub` mode: red = brighter in b, blue = brighter in a. A moving source shows up as a red/blue pair.
With `images=url` the answer has `"url": "/img/<token>.png"` instead of `image`.

## `GET /api/track`
Where the source at (`ra`, `dec`) is in each survey pass, and its proper motion fitted to that.

| param | type | default | notes |
|---|---|---|---|
| `ra`, `dec` | float | required | degrees; the source must be within ~18" (3 px) of this in the first pass |
| `det` | string | `D6` | brown dwarfs are brightest in `D5`/`D6`; normal stars show in every detector |
| `fov` | float | `0.05` | degrees, min `0.029` |

```json
{ "query": { "ra": 133.759895, "dec": -7.242249, "fov": 0.05, "det": "D6", "release": "dr1+qr3" },
  "unit": "mas/yr",
  "measured": [ { "mjd": 60800.7453, "date": "2025-05-05", "detected": false },
                { "mjd": 60995.8173, "date": "2025-11-10", "detected": true, "ra": 133.7597217, "dec": -7.2419946,
                  "err": 1189.7, "snr": 15.0, "n_exposures": 21, "saturated": false } ],
  "fit": { "pmra": -7032.5, "pmra_err": 3817.0, "pmdec": 1696.8, "pmdec_err": 3817.0, "n_epochs": 2, "years": 0.44,
           "saturated": false },
  "catalog_pm": { "id": "wise0855", "name": "WISE 0855-0714", "pmra": -8118.0, "pmdec": 673.0,
                  "source": "targets.py", "separation_arcsec": 0.0 },
  "compare": { "pmra_diff": 1085.5, "pmra_sigma": 0.3, "pmdec_diff": 1023.8, "pmdec_sigma": 0.3 } }
```
- `measured`: one entry per survey pass, the centroid of the source in that pass's stacked image. `err` is the
  position error in mas: the larger of the centroid's own error and the scatter between the pass's single
  exposures. A pass where nothing is found at S/N 5 has `"detected": false` and no position.
- The first pass is searched around (`ra`, `dec`), each later pass around the previous position, so a fast mover
  is followed. `saturated`: the core had no data, so the centre comes from the ring around it, which is often
  lopsided; such points get an error of at least 0.5 px (~3"). The fit skips them when there are 2+ clean ones,
  and `fit.saturated` says if any were used.
- `fit`: straight line through the positions, in mas/yr (`pmra` includes cos(dec)). `null` with fewer than two
  detections. Parallax is not fitted: passes are ~6 months apart, so a nearby object's parallax (WISE 0855:
  ~0.45") adds an alternating offset, which shows up in the errors.
- `catalog_pm`: the catalogue proper motion if the position is one of the test targets, from our own list
  (`targets.py`), else `null`. No external catalogue is queried. `compare`: fit minus catalogue, and how many
  errors apart.
- Faint sources: WISE 0855 reaches S/N ~15 per pass in `D6` and is not found in a pass with only a few
  exposures. It also passes ~6" from a background star, which pulls the centroid a little.
- Answers 202 while the data downloads, like `/api/frames`.

## `GET /api/rgb`
Infrared colour picture: `D1` (0.75-1.1 um) blue, `D3` (1.6-2.4 um) green, `D6` (4.4-5.0 um) red.

| param | type | default | notes |
|---|---|---|---|
| `ra`, `dec` | float | required | degrees |
| `fov` | float | `0.1` | degrees, max `0.5` |
| `images` | string | `url` | `url`: a link to the PNG (`GET /img/...`). `inline`: a base64 data URL in `image` |

```json
{ "query": { "ra": 133.759895, "dec": -7.242249, "fov": 0.1, "release": "dr1+qr3" },
  "channels": { "red": "D6", "green": "D3", "blue": "D1" },
  "n_exposures": { "red": 45, "green": 45, "blue": 44 },
  "url": "/img/eyJr....png" }
```
- Every exposure of each detector is stacked (median), so the picture is deep but has no time information.
- Each channel is stretched on its own, so colour compares a source with the rest of the field: red sources are
  bright at 4-5 um compared with 1-2 um, e.g. cold brown dwarfs (WISE 0855 is red).
- Needs three downloads (one per detector). While they run it answers 202 with `status`, `done`, `total` (summed
  over the running ones) and `detectors` (each detector's own status).

## `GET /img/{token}.png`
The PNG behind a `url` from `/api/frames?images=url`, `/api/diff?images=url` or `/api/rgb`. Use the link exactly as given and
put the API address in front of it: `<img src="http://localhost:8000/img/eyJr....png">`.
- The JSON is about 4x smaller (WISE 0855, 3 frames: 1.2 KB instead of 4.6 KB; much more for big fields) and the browser
  caches and decodes the images itself. The image is pixel-identical to the inline one.
- Same stretch for every frame of a request, so the blink stays fair.
- The link contains the request itself (position, fov, detector, wavelength range, frame), so it keeps working after a
  server restart: the PNG is rendered again from the cached exposures. It **never starts a download**: if the position
  has not been fetched yet it answers 404, so call `/api/frames` first.
- `Cache-Control: public, max-age=86400`.
- Errors: 404 not downloaded yet or no such frame, 422 not a valid link.

## `GET /api/spectrum`
Brightness of whatever sits at (`ra`, `dec`) against wavelength: one point per exposure.

| param | type | default | notes |
|---|---|---|---|
| `ra`, `dec` | float | required | degrees; the source must be at this position |
| `det` | string | `all` | `all` covers 0.75-5.0 um; one detector is faster |
| `fov` | float | `0.05` | degrees, min `0.026`. Pass the `fov` and `det` of your `/api/frames` call to reuse its data |
| `wmin`, `wmax` | float | none | micrometres |

```json
{ "query": { "ra": 269.4463, "dec": 4.7679, "fov": 0.05, "det": "all", "wmin": null, "wmax": null, "release": "dr1+qr3" },
  "ra": 269.4463, "dec": 4.7679, "flux_unit": "mJy", "n_skipped": 2,
  "points": [ { "wavelength_um": 1.23, "flux": 45.1, "error": 3.2, "mjd": 60816.40012, "det": "D2", "flags": [] } ] }
```
- Points are sorted by wavelength. `flux` and `error` are in mJy.
- Measured on zodi-subtracted data: pixels within 2 px (about 12") of the position, minus the local sky from a
  ring around it (bad pixels masked in the ring). `error` comes from the VARIANCE extension. No aperture
  correction, so fluxes are a few per cent low. A neighbour inside the 12" circle is included.
- `flags`: bad-pixel flags found under the source in that exposure. Empty = clean. Bright stars saturate the
  detector, so their points carry `OVERFLOW`, `NONLINEAR` or `PERSIST`: the flux is then unreliable (too low if
  saturated). Draw flagged points differently, or hide them.
- `n_skipped`: exposures with no value under the source at all. Very bright stars (Barnard's Star, R Dra)
  saturate so badly that most or all exposures are skipped; a spectrum then covers only part of the range, or
  the call answers 404.
- The points are taken at different times (`mjd`). For a variable source the spectrum mixes both.
- Answers 202 while a new position downloads, like `/api/frames`. 404 if nothing usable.

## `GET /api/lightcurve`
Brightness against time: one point per survey pass. Same measurement as `/api/spectrum`.

| param | type | default | notes |
|---|---|---|---|
| `ra`, `dec` | float | required | degrees |
| `det` | string | `D3` | `D1`..`D6`, or `all` |
| `fov` | float | `0.05` | degrees, min `0.026` |
| `wmin`, `wmax` | float | none | micrometres; a narrow range compares like with like between passes |

```json
{ "query": { "ra": 76.9567, "dec": 30.4011, "fov": 0.05, "det": "D3", "wmin": null, "wmax": null, "release": "dr1+qr3" },
  "ra": 76.9567, "dec": 30.4011, "flux_unit": "mJy", "method": "aperture",
  "points": [ { "mjd": 60993.21, "date": "2025-11-14", "flux": 512.3, "error": 20.1,
                "n_exposures": 14, "n_exposures_total": 14, "wavelength_um": 2.01,
                "flagged": false, "flags": [] } ] }
```
- A pass uses its clean exposures if it has any (`n_exposures` of `n_exposures_total`). If every exposure is
  flagged, they are used anyway and the point has `"flagged": true` with the `flags` met: treat that flux as
  unreliable (bright stars saturate).
- `flux` is the median over the pass's exposures; `error` is their scatter divided by sqrt(n). The exposures of a
  pass are at different wavelengths, so the scatter includes the slope of the spectrum.
- `method`: `aperture` is the normal measurement. `wings` is used when the star is so bright that its core has
  no usable pixels in most exposures: the brightness is then taken from a ring 8-11 px out, which scales with
  the star. Those values are **relative** (a fraction of the star's light, fine for seeing it brighten or
  fade, not comparable with catalogue fluxes or with `aperture` values), every point has `"flagged": true`
  and `flags: ["SATURATED"]`, and `fov` must be at least `0.05`.
- `wavelength_um`: median wavelength of the exposures used. If it differs a lot between passes, part of the
  change in `flux` is colour, not variability: narrow it with `wmin`/`wmax`.

## `GET /api/catalog`
Gaia DR3 stars in the field, for the overlay, moved to the frame's date with their proper motion.

| param | type | default | notes |
|---|---|---|---|
| `ra`, `dec` | float | required | degrees, centre of the field |
| `fov` | float | `0.1` | degrees |
| `mjd` | float | 2025.9 | the frame's `mjd` |

```json
{ "epoch": 2025.9, "source": "Gaia DR3",
  "stars": [ { "source_id": "4472832130942575872", "ra": 269.4463, "dec": 4.7679,
               "pmra": -801.6, "pmdec": 10362.4, "gmag": 8.19 } ] }
```
- At most 2000 stars, brightest first. 502 if Gaia does not answer. In mock mode only the test targets.

## `GET /api/context`
"Is it new?": is the thing at (`ra`, `dec`) in a frame taken at `mjd` already known? Fixed rules, no LLM.

| param | type | default | notes |
|---|---|---|---|
| `ra`, `dec` | float | required | degrees: the clicked position |
| `mjd` | float | required | the frame's `mjd` |
| `fov` | float | `0.1` | degrees: how much of the field `stars` and `asteroids` cover |
| `artifact_fraction` | float | none | the frame's value from `/api/frames`, for the artifact warning |

```json
{ "query": { "ra": 133.759895, "dec": -7.242249, "mjd": 61157.93, "fov": 0.1, "epoch": 2026.302 },
  "verdict": "known_other",
  "match": { "name": "WISEA J085510.74-071442.5", "type": "BD*", "source": "SIMBAD", "distance_arcsec": 1.17 },
  "other_matches": [ { "name": "Gaia DR3 5756956644387831296", "type": "star", "source": "Gaia DR3",
                       "gmag": 16.31, "distance_arcsec": 3.53, "verdict": "known_star" } ],
  "match_radius_arcsec": 12.3,
  "stars": [ { "source_id": "...", "ra": 133.75, "dec": -7.24, "pmra": -3.1, "pmdec": 1.2, "gmag": 17.2 } ],
  "asteroids": [ { "name": "Ceres", "number": 1, "type": "MB>Middle", "ra": 0, "dec": 0, "vmag": 8.1,
                   "posunc_arcsec": 0.1 } ],
  "warnings": [] }
```
- `verdict`: `known_star` (Gaia DR3), `known_asteroid` (SkyBoT), `known_other` (SIMBAD), `unexplained`
  (nothing within `match_radius_arcsec`, ~2 px), or `unknown` (nothing found, but a catalogue did not answer:
  see `warnings`).
- Every catalogue is moved to the frame's date first: Gaia from epoch 2016.0 with its proper motion; SkyBoT
  computes where asteroids and comets were at that time; SIMBAD from J2000 with its own proper motion.
- The **closest** object within the radius wins; if two are within 0.5" of each other (the same object in two
  catalogues, e.g. Barnard's Star in Gaia and SIMBAD) the order is Gaia, SkyBoT, SIMBAD. Taking the rule order
  strictly would let any faint Gaia star within 12" beat the real match. `other_matches` lists the rest: show
  them, because SPHEREx pixels are 6" and two objects a few arcsec apart cannot be told apart by position.
  Example: on 2026-04-21 WISE 0855 is ~3" from a background star.
- `warnings`: `"may be an artifact"` when `artifact_fraction` > 0.05. A catalogue that fails is reported
  here (`"Gaia unavailable: ..."`) instead of failing the request. SIMBAD is asked at its main site
  (Strasbourg) and, if that is down, at its official mirror (Harvard). Failed answers are not cached.
- `stars`: Gaia stars in the field at the frame's date (as `/api/catalog`). `asteroids`: SkyBoT objects in the
  field at that moment.
- Answers are cached on disk by position and date, so clicking the same spot again is instant. The first
  click asks three services and can take several seconds.
- Mock mode: no network; the test targets stand in for the catalogues (WISE 0855 as a SIMBAD object).

## Errors
```json
{ "detail": "No SPHEREx images cover this position" }
```
with HTTP 404 (nothing found), 422 (bad params), 502 (IRSA failed) or 503 (too many requests waiting, try again).
