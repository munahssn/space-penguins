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
Open http://localhost:8000 for the app and http://localhost:8000/docs for the interactive API.
Shareable links work: `http://localhost:8000/?ra=133.768&dec=-7.243&fov=0.1&det=D3`

## Git rules
- `main` always works. Work on branches (`frontend/player`, `backend/spectrum`), merge via PR.
- Never commit `backend/cache/` or `.venv/` (already in `.gitignore`).
- API changes: update `docs/API.md` and `app/mock.py` in the same PR.
