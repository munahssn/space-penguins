# SPHEREx Blink (Space Penguins) - NASA Space Apps 2026

Since 2025, NASA’s SPHEREx mission has been mapping the entire sky every six months in 102 bands of near-infrared light, returning images of more than a billion objects. Comets, asteroids, stars, brown dwarfs, and even new planets reveal themselves by shifting position between images, but no one person can sift through all that data alone. The challenge is to create a public-facing web tool to display images of the sky from SPHEREx mission, making it easy for anyone to quickly see how they change over time.

```
space_penguins/
├── docs/API.md          <- the contract between frontend and backend. Read first.
├── backend/             <- Python, FastAPI (team: backend)
│   ├── app/main.py        creates the app, includes the routers
│   ├── app/routers/       endpoints, one file per group (system, frames, analysis, context)
│   ├── app/config.py      settings: mock mode, paths, detectors
│   ├── app/cache.py       disk cache of stacked images
│   ├── app/validation.py  query parameter checks
│   ├── app/spherex.py     IRSA query, cutouts, stacking, PNG rendering
│   ├── app/targets.py     the 5 test targets (with proper motion)
│   ├── app/mock.py        fake data for frontend dev
│   └── scripts/precache.py
└── frontend/            <- plain HTML/CSS/JS, no build step (team: frontend)
```

## Setup (Windows, PowerShell)

```powershell
cd backend
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```
(macOS/Linux: `source .venv/bin/activate`)

## Run

```powershell
# Real data from IRSA (DR1 + QR3 by default; set $env:SPHEREX_COLLECTIONS to change)
uvicorn app.main:app --reload

# Fake data (frontend team uses this)
$env:SPHEREX_MOCK=1; uvicorn app.main:app --reload
```
Where the pixels come from (`SPHEREX_SOURCE`): by default the backend reads only the small pixel box it needs
from IRSA's public S3 bucket (`nasa-irsa-spherex`, no credentials) and falls back to IRSA's cutout service if S3
fails. Set `$env:SPHEREX_SOURCE="irsa"` to use the cutout service only.

### Protection (when the API is public)
Settings are environment variables, listed at the top of `backend/app/config.py`:

| variable | what for |
|---|---|
| `CORS_ORIGINS` | Websites whose browsers may call the API, comma separated, e.g. `https://our-site.vercel.app`. **Set this on the server**: the default allows only localhost dev servers (and replaces them when set). |
| `TRUST_PROXY_HOPS=1` | Set on the server when a proxy sits in front (Hugging Face, ...) so the rate limit sees each visitor's own address. Leave unset locally. |
| `RATE_LIMIT=off` | Turn the per-IP limit off (tests, precache). |
| `MAX_EXPOSURES_PER_JOB` | Most exposures one request may download or return (default 400). |

Per IP and minute: 60 `/api/frames` + `/api/diff`, 30 `/api/resolve`, 600 `/img/...`, 120 other API calls; more gets
HTTP 429 with `Retry-After`. The health check and the frontend files are not limited.

On the server start uvicorn as **`uvicorn app.main:app --workers 1 --no-proxy-headers`** (one worker: jobs and rate
limit live in memory; `--no-proxy-headers`: otherwise uvicorn trusts `X-Forwarded-For` itself when the connection
comes from localhost and the header can be forged).

Open http://localhost:8000 for the app and http://localhost:8000/docs for the interactive API.
Shareable links work: `http://localhost:8000/?ra=133.768&dec=-7.243&fov=0.1&det=D3`

## Git rules
- `main` always works. Work on branches (`frontend/player`, `backend/spectrum`), merge via PR.
- Never commit `backend/cache/` or `.venv/` (already in `.gitignore`).
- API changes: update `docs/API.md` and `app/mock.py` in the same PR.
