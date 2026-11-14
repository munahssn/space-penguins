# SPHEREx Blink — System Design (v2)

**One-line pitch:** anyone can find a moving object in SPHEREx data, and check whether it's already known.

Status: this is the target design. `docs/API.md` describes what the code does *today* (v0);
it gets updated to the API below as the backend is built.

**v2 changes:** hosting named in the diagram, job sharing + max 2 jobs + queue position, full job/cache
key, wavelength slider, WISE toggle, Explain service (rules decide, LLM only words it), basic protection
(rate limit, CORS), cold-start handling.

---

## 1. Tech stack

| Layer | Tech | Why |
|---|---|---|
| Frontend | React + Vite (on **Vercel**, custom domain from GoDaddy) | Team knows it; Vercel deploys on every push |
| | HTML `<canvas>` | Frame player: blink, zoom, overlay circles/labels |
| | Aladin Lite v3 | Context sky map + WISE toggle (fetches its own tiles/catalogs from CDS) |
| | Recharts | Spectrum, light curve, motion track charts |
| | URL query params | Shareable/embeddable links (`?ra&dec&fov&det&mode&display&wmin&wmax`) |
| | three.js (optional) | Small 3D sky globe on the start page only |
| Backend | Python, FastAPI, Uvicorn (on **Hugging Face Spaces**, Docker) | Everyone knows Python; free auto docs at `/docs` |
| | astroquery, pyvo | IRSA image search, SkyBoT asteroids, Gaia via VizieR, name lookup |
| | astropy, fsspec | FITS reading, partial (range) reads from S3 |
| | reproject | Put every frame on one common sky grid |
| | numpy, Pillow | Stacking, differences, colour images, PNGs |
| | Disk cache (folders) | Never download or compute the same thing twice |
| | LLM API, free tier (optional) | Plain-language wording for the "Is it new?" verdict |

## 2. Architecture

```
┌──────────────────────────── BROWSER (React + Vite, on Vercel) ─────────────────┐
│ SearchBar ─► URL state (?ra&dec&fov&det&mode&display&wmin&wmax&embed)        │
│                                                                                │
│ FramePlayer (canvas)   ControlPanel          Charts (Recharts)    SkyMap       │
│  blink / diff / RGB     speed, FOV, det,      spectrum, light     (Aladin Lite)│
│  + Gaia circles         mode, flags,          curve, motion       + WISE toggle│
│  + asteroid labels      wavelength slider     track                            │
│                                                                                │
│ "Is it new?" panel  ── verdict (rules) + plain-language text (template / LLM)  │
│ Status bar          ── "waking up server…" / "queued #1" / "processing 40/120" │
└──────────┬───────────────────────────────────────────────────────────┬─────────┘
           │ REST/JSON + PNG URLs (poll while queued/processing)       │ direct
           ▼                                                           ▼
┌────────────────────── BACKEND (FastAPI, on Hugging Face Spaces) ──────┐  CDS (tiles,
│ Guard  CORS: our Vercel domain(s) only · per-IP rate limit            │  catalogs,
│                                                                       │  WISE)
│ API   /api/resolve /frames /img/{id}.png /diff /rgb /context /track   │
│       /spectrum /lightcurve /explain /health                          │
│                                                                       │
│ Job runner  key = (ra, dec, fov, det, mode, wmin, wmax, pipeline_ver) │
│             identical requests share one job · max 2 running ·        │
│             others queued with position · progress %                  │
│                                                                       │
│ Services  1 Finder   2 Fetcher   3 Processor   4 Measure              │
│           5 Context (Gaia, SkyBoT)   6 Spectrum + light curve         │
│           7 Explain (rules → verdict; template or LLM → wording)      │
│                                                                       │
│ Cache  cache/<pipeline-version>/{meta,fits,png,context,explain}       │
└──────┬─────────────┬───────────────┬────────────────┬─────────────┬───┘
       ▼             ▼               ▼                ▼             ▼
   IRSA SIA/TAP   AWS S3 bucket   IRSA cutout     SkyBoT / VizieR  LLM API
   (search)       (patch reads)   (fallback)      / Sesame         (free tier,
                                                                    optional)
```

## 3. How one request flows

1. Page load → frontend calls `/api/health`. No answer within ~3 s → show **"Waking up the server…"**
   and keep retrying (a sleeping Hugging Face Space takes about a minute).
2. User types "WISE 0855" → `/api/resolve` → RA/Dec go into the URL.
3. Frontend calls `/api/frames`:
   - cached → **200** with frames instantly
   - same job already running → **202** for that job (no new work)
   - 2 jobs already running → **202** `{status: "queued", position: 1}`
   - started → **202** `{status: "processing", done: 40, total: 120}`

   Frontend polls every 2 s and shows frames as they become ready.
4. **Finder** queries IRSA for images covering the point (DR1 + QR3, same exposure kept once, DR1 preferred).
5. **Fetcher** reads only the small patch from each file, 8 at a time, and caches the patch.
6. **Processor** cleans and aligns patches, applies the wavelength filter, builds products, saves PNGs.
7. **Context** fetches Gaia stars (moved to each frame's date) and known asteroids (SkyBoT).
8. Frontend preloads PNGs and blinks. Gaia circles + asteroid labels drawn on the canvas.
9. User clicks a dot → `/api/context` gives the verdict at once; `/api/explain` fills in the
   plain-language text a moment later (template first, LLM text replaces it if it arrives).

## 4. Data processing

**Clean (every patch)**
- Mask only *bad* pixels: FLAGS bits TRANSIENT, OVERFLOW, SUR_ERROR, NONFUNC, DICHROIC, MISSING,
  HOT, COLD, NONLINEAR, PERSIST, OUTLIER.
- **Never** mask `flags != 0`: the SOURCE bit is set on nearly every star pixel.
- Artifact bits (CROSSTALK, GHOST*, STREAK, BLOOM, SNOWBALL, HALO) are not masked but reported per
  frame as `artifact_fraction`, because they can fake a mover.
- Subtract ZODI (it is *not* pre-subtracted in IMAGE).

**Align:** reproject each patch onto one north-up grid (6.15″/px) centred on the target, using the
file's sky WCS. Skipping this makes everything jitter.

**Wavelength slider (`wmin`, `wmax` in µm)**
- SPHEREx uses linear variable filters: each exposure sees the target at a *different wavelength*.
- The slider means: **only use exposures where the target fell between `wmin` and `wmax`**
  (wavelength at the target pixel from WCS key `W`, SIP off).
- Inside a small patch the wavelength barely changes, so one value per exposure is enough.
- Fewer exposures → noisier frames. Every frame reports `n_exposures` and `n_exposures_total`, and the
  UI shows "6 of 14 exposures used".
- Default: no filter (whole detector range).

**Products**

| Product | How | For |
|---|---|---|
| Epoch blink (default) | Per detector, inverse-variance weighted stack of each ~6-month survey pass | Brown dwarfs, fast stars |
| Exposure blink ("asteroid mode") | Every single exposure in time order, each normalised to its own background | Asteroids/comets (move within days) |
| Difference | Last pass − first pass (or any two) | Movers = blue/red pair |
| Stack | Sum passes or detectors | Faint objects |
| Infrared colour | D1 → blue, D3 → green, D6 → red, each normalised | Cold brown dwarfs look very red |
| Motion track | Centroid of the target in each pass vs. catalog prediction | "Measured X″/yr vs. Gaia 10.4″/yr" |
| Spectrum | Brightness at the position in every exposure + its wavelength, error from VARIANCE | Ice lines: H₂O 3.0, CO₂ 4.27, CO 4.67 µm |
| Light curve | Brightness per pass for one detector | RW Aur, R Dra |
| Flag overlay | Masked pixels as a tint | What to distrust |

Why epochs and not raw exposures by default: blinking raw exposures flickers in brightness even when
nothing moves, because each one is a different wavelength.

## 5. "Is it new?" — Context + Explain

**The verdict is decided by rules only. The LLM never decides anything.**

Rules (Context service), for a clicked position and frame date:
1. **Gaia DR3** star within ~2 px after moving it from epoch 2016.0 to the frame date → `known_star`.
2. **SkyBoT** known asteroid/comet at that time and place → `known_asteroid`.
3. Other catalog match (SIMBAD, e.g. faint brown dwarfs not in Gaia) → `known_other`.
4. Nothing → `unexplained` + "Report candidate" button (saves coords, frames, note to JSON).
5. Artifact flags high in that frame → add warning `"may be an artifact"`.

Wording (Explain service):
- **Template first, always works:** "Matches Gaia DR3 4472…, a star moving 10.4″/yr. Our measurement: X″/yr."
- **LLM optional, on top:** gets *only* the structured facts (verdict, match name and type, catalog
  motion, measured motion, artifact warning) and is told to use nothing else and add one sentence of
  public-friendly background (e.g. what a brown dwarf is).
- If the LLM fails, times out (> 5 s) or hits the free-tier limit → template text stays. The user never sees an error.
- Cache every explanation by (verdict facts hash). Pre-generate for all demo targets.
- API key lives in a Hugging Face Space **secret**, never in the React code or the repo.

## 6. API (target)

| Endpoint | Returns |
|---|---|
| `GET /api/health` | `{ok, release, latest_data_date, pipeline_version, jobs_running, jobs_queued}` |
| `GET /api/resolve?name=` | `{name, ra, dec}` |
| `GET /api/targets` | `[{id, name, ra, dec, note}]` (test targets, positions moved to the SPHEREx era) |
| `GET /api/frames?ra&dec&fov&det&mode=epoch\|exposure&wmin&wmax` | 200 `{frames:[…], grid}` · 202 `{status:"queued", position}` · 202 `{status:"processing", done, total}` |
| `GET /img/{id}.png` | PNG, `Cache-Control: immutable` |
| `GET /api/diff?…&a&b&op=sub\|add` | `{url}` (same 202 rules) |
| `GET /api/rgb?ra&dec&fov` | `{url}` (same 202 rules) |
| `GET /api/context?ra&dec&fov&mjd` | `{verdict, match:{name, type, source}, stars:[{gaia_id, ra, dec, gmag, pmra, pmdec}], asteroids:[{name, ra, dec, vmag}], warnings:[…]}` |
| `GET /api/explain?ra&dec&mjd` | `{text, source:"template"\|"llm"}` |
| `GET /api/track?ra&dec` | `{measured:[{mjd, ra, dec, err}], catalog_pm:{pmra, pmdec}, fit:{pmra, pmdec}}` |
| `GET /api/spectrum?ra&dec` | `{points:[{wavelength_um, flux, error, mjd, det}]}` |
| `GET /api/lightcurve?ra&dec&det` | `{points:[{mjd, flux, error}]}` |

Frame object: `{id, url, date, mjd, det, wavelength_um, n_exposures, n_exposures_total, flagged_fraction, artifact_fraction}`.

Rules:
- Frame `id` = hash of the **full job key** + file list. Images by URL, never embedded in JSON.
- Errors: 404 no data · 422 bad params · 429 rate limited · 502 IRSA failed · 503 IRSA busy (frontend retries).

## 7. Jobs, protection, hosting

**Job runner**
- Key = `(ra, dec, fov, det, mode, wmin, wmax, pipeline_version)`, rounded (ra/dec to 1e-5°,
  wavelengths to 0.01 µm) so tiny differences share a job. The cache uses the same key.
- Identical requests attach to the running job. Max **2** jobs at once (Hugging Face has 2 CPUs);
  the rest wait in a FIFO queue and see their position.
- Job state lives in memory: fine for a hackathon. A restart loses running jobs; finished ones stay in the cache.

**Protection (it's a public URL)**
- CORS: only our Vercel domain(s) and `localhost` for dev.
- Per-IP rate limit: e.g. 20 `/frames` and 10 `/explain` requests per minute (`slowapi` or a small dict).
- Caps: FOV ≤ 0.5°, ≤ 400 exposures per job, ≤ 20 queued jobs.

**Hosting**
- Frontend: Vercel, connected to GitHub (deploys on push), custom domain from GoDaddy via DNS records.
- Backend: Hugging Face Space (Docker), demo cache baked into the image (< 300 MB), LLM key as a Space secret.
- Frontend reads the backend URL from `VITE_API_URL`.
- Final demo video recorded with everything running locally (no cold start, no network risk).

## 8. Data strategy

- **Live:** search IRSA, read only the needed patch (S3 range read; IRSA cutout service as fallback).
- **Cache:** search results, patch FITS, PNGs, context, explanations. Keyed by release + pipeline version.
- **Pre-warmed:** 5 test targets + notebook example + 2–3 extras, baked into the backend image.
- **Never** store full 65 MB files.
- **New releases:** collections list is one setting (`SPHEREX_COLLECTIONS`). A weekly GitHub Action
  re-runs `precache`. Header shows "latest data: <date>".
- **Be polite to IRSA:** max 8 parallel downloads per job, exponential backoff.

## 9. Risks

| Risk | Plan |
|---|---|
| S3 partial reads don't work (FLAGS is tile-compressed) | Person A tests IMAGE *and* FLAGS first; fallback = IRSA cutout service |
| IRSA busy/slow | Cache, retries, pre-warmed demo targets, 503 → frontend retry message |
| First load of a new target is slow | Background job, queue position, progress, frames appear as ready |
| Hugging Face sleeps | `/health` check on load + "waking up" message; demo cache in the image |
| LLM rate limit / wrong facts | Rules decide; LLM gets only facts; template fallback; cached; pre-generated for demo |
| Someone abuses the public API | CORS, per-IP rate limit, caps |
| Motion is only ~1–2 px so far | Lead with difference image + measured track, not raw blink |

## 10. Who builds what

| Person | Owns |
|---|---|
| A (backend) | Finder, Fetcher (S3 test first!), cache, job runner + queue, rate limit, precache + GitHub Action |
| B (backend) | Processor (stacks, diff, RGB, wavelength filter), Measure, Context, Spectrum, Explain, API layer |
| C (frontend, Person 1) | FramePlayer (canvas + overlays), charts, "Is it new?" panel. See `FRONTEND_PLAN.md` |
| D (frontend, Person 2) | App shell, `api.js` + mock switch, URL state + embed, SearchBar, ControlPanel (incl. wavelength slider), status bar, SkyMap (+ WISE toggle), Vercel + domain, README, video, submission |

## 11. Build order

1. **MVP:** epoch blink + difference for WISE 0855, real data, end to end.
2. **Core:** job runner (sharing, queue, progress), image URLs, Gaia circles, flags panel, name search, health/cold-start.
3. **Stand-out:** "Is it new?" with rules + template text, motion track, RGB, spectrum with ice lines.
4. **Extras:** wavelength slider, asteroid mode, light curves, WISE toggle, report button, embed, LLM wording, 3D globe.
5. **Freeze → polish:** rate limit/CORS on, deploy, test all targets live, README with GIFs, demo video, pitch.
