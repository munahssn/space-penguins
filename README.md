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

# Fake data, no internet needed (frontend team uses this)
$env:SPHEREX_MOCK=1; uvicorn app.main:app --reload
```
Open http://localhost:8000 for the app and http://localhost:8000/docs for the interactive API.
Shareable links work: `http://localhost:8000/?ra=133.768&dec=-7.243&fov=0.1&det=D3`

## Phase 0 checklist

**Everyone**
- [ ] Read `docs/API.md`, agree on it (or change it now, together)
- [ ] Create a GitHub repo, push this folder, everyone clones it
- [ ] Get mock mode running on every laptop

**Backend**
- [ ] `python -m scripts.phase0_check` (repeats IRSA's intro notebook on its example spot: query, download, extensions, wavelength, flags)
- [ ] `python -m scripts.precache --only notebook-example` (first real blink, then open it in the app)
- [ ] `python -m scripts.precache` (all 5 targets, saved to `backend/cache/`)
- [ ] Look at the output: how many epochs per target? How long did it take? Does the mover show?
- [ ] Check the positions in `app/targets.py` against SIMBAD / Gaia DR3
- [x] FLAGS: done from IRSA's intro notebook (bad bits masked, artifact bits reported; see `spherex.py`)
- [ ] Try `--det all` on one target: is stacking all 6 detectors worth it?

**Frontend**
- [ ] Run in mock mode, click through all 5 targets
- [ ] Decide: stay with plain JS, or move to React/Vite? (plain JS is fine for a hackathon)
- [ ] Sketch the final layout: viewer, controls, metadata panel, later spectrum chart + Gaia overlay
- [ ] Try Aladin Lite in a test page (for the sky background + overlays in Phase 2)

## Git rules
- `main` always works. Work on branches (`frontend/player`, `backend/spectrum`), merge via PR.
- Never commit `backend/cache/` or `.venv/` (already in `.gitignore`).
- API changes: update `docs/API.md` and `app/mock.py` in the same PR.

## Next phases
1. **MVP (h2-14):** real blink for WISE 0855 end to end
2. **Core (h14-30):** all-detector stack, Gaia arrows, flags panel, name search
3. **Standout (h30-40):** click-for-spectrum, light curves, WISE overlay, embed code
4. **Polish (h40-48):** deploy, test 5 targets live, demo video, pitch
