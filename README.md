# SPHEREx Blink (Space Penguins) - NASA Space Apps 2026

Type in a patch of sky, see every SPHEREx image of it as a looping "blink",
so moving objects (brown dwarfs, fast stars, asteroids) jump out.

```
space_penguins/
├── docs/API.md          <- the contract between frontend and backend. Read first.
├── backend/             <- Python, FastAPI (team: backend)
│   ├── app/main.py        endpoints + disk cache
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
