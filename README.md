# SPHEREx Blink (Space Penguins) - NASA Space Apps 2026

Since 2025, NASA’s SPHEREx mission has been mapping the entire sky every six months in 102 bands of near-infrared light, returning images of more than a billion objects. Comets, asteroids, stars, brown dwarfs, and even new planets reveal themselves by shifting position between images, but no one person can sift through all that data alone. The challenge is to create a public-facing web tool to display images of the sky from SPHEREx mission, making it easy for anyone to quickly see how they change over time.

```
space_penguins/
├── docs/API.md          <- the contract between frontend and backend. Read first.
├── backend/             <- Python, FastAPI (team: backend)
│   ├── app/main.py        creates the app, includes the routers
│   ├── app/routers/       endpoints, one file per group (system, resolve, frames, images, analysis, context, explain)
│   ├── app/config.py      settings: mock mode, paths, detectors
│   ├── app/cache.py       disk cache of stacked images
│   ├── app/jobs.py        background jobs (slow endpoints answer 202 while they run)
│   ├── app/validation.py  query parameter checks
│   ├── app/spherex.py     IRSA query, cutouts, stacking, PNG rendering
│   ├── app/s3io.py        reads small pieces of FITS files from IRSA's public S3 bucket
│   ├── app/catalogs.py    Gaia, SkyBoT and SIMBAD lookups for "Is it new?"
│   ├── app/explain.py     plain-language text for the verdict
│   ├── app/targets.py     the 5 test targets (with proper motion)
│   ├── app/mock.py        fake data for frontend dev
│   └── scripts/           precache.py, phase0_check.py (checks IRSA access)
└── frontend/            <- React + Vite (team: frontend), see docs/FRONTEND_PLAN.md
    ├── src/api/api.js     every backend call + mock switch
    ├── src/api/mock/      fake responses (shapes from docs/DESIGN.md §6)
    ├── src/hooks/         shared state: the view (in the URL), server status, requests
    ├── src/components/    one folder per part of the page (player, charts, verdict, …)
    ├── src/pages/         start page, viewer, embed
    ├── src/utils/         small helpers shared by several components
    ├── src/styles/        theme tokens and base styles
    └── public/images/     start page pictures (popular finds pictures go in targets/)
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

Open http://localhost:8000/docs for the interactive API.

## Frontend

```powershell
cd frontend
npm install
npm run dev        # http://localhost:5173
```
`frontend/.env` sets `VITE_USE_MOCK=true` (no backend needed) and `VITE_API_URL=http://localhost:8000`.
To use the real backend, create `frontend/.env.local` with `VITE_USE_MOCK=false` and restart `npm run dev`.
Shareable links work: `http://localhost:5173/?ra=133.768&dec=-7.243&fov=0.1&det=D3`
(`npm run build` also lets the backend serve the app at http://localhost:8000.)

Deploying (Vercel + domain): see `docs/DEPLOY.md`.

## Git rules
- `main` always works. Work on branches (`frontend/player`, `backend/spectrum`), merge via PR.
- Never commit `backend/cache/` or `.venv/` (already in `.gitignore`).
- API changes: update `docs/API.md` and `app/mock.py` in the same PR.
