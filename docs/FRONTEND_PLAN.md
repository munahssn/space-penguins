# Frontend plan: 2 people

Stack per `DESIGN.md`: React + Vite on Vercel, `<canvas>` player, Recharts, Aladin Lite.
The current `frontend/` (plain JS) is the Phase 0 starter. Issue #1 replaces it with a Vite app
(move the old one to `frontend-old/`).

**Split in one line:** Person 1 owns *what you look at* (player, overlays, charts, verdict).
Person 2 owns *everything around it* (app shell, data layer, controls, search, sky map, start page,
deploy, submission).

Issue numbers below match the GitHub issues (#1–#17).

## File ownership

| Person 1 (visuals) | Person 2 (shell + data) |
|---|---|
| `src/components/player/` (FramePlayer, modes, overlays) | `src/App.jsx`, `src/main.jsx`, `src/styles/` |
| `src/components/charts/` (spectrum, motion track, light curve) | `src/api.js` (fetch, polling, mock switch), `src/mock/` |
| `src/components/verdict/` ("Is it new?" panel) | `src/hooks/useViewState.js` (URL state incl. `embed`) |
| | `src/components/search/`, `controls/`, `status/`, `skymap/` |
| | `src/pages/Start.jsx` |
| | `vercel.json`, `README.md`, demo video, submission text |

Touching the other person's files: small fixes OK, tell them. Bigger changes go through a PR they review.

## Shared contract (agree in phase 0, then don't change without talking)

- `useViewState()` returns `{ra, dec, fov, det, mode, wmin, wmax, selected, embed}` plus a setter,
  synced to the URL (`selected` is the clicked RA/Dec; it's not put in the URL).
  `embed` is in from the start, so embed mode later is just "hide things when `embed` is true".
- `api.js` exports one function per endpoint: `getHealth, resolve, getFrames, getDiff, getRgb,
  getContext, getExplain, getTrack, getSpectrum, getLightcurve`. Components never call `fetch` directly.
- Every function returns the JSON shape from `docs/DESIGN.md` §6, in mock mode too.
  If a shape has to change: update `DESIGN.md`, `src/mock/` and tell the backend team in the same PR.
- Mock switch: `VITE_USE_MOCK=true` makes `api.js` return the JSON in `src/mock/`.
  The Vercel build uses it until the Hugging Face backend is live, because the deployed site can't
  reach a laptop. Real backend URL: `VITE_API_URL`.
- `getFrames` hides the polling: it resolves with frames, and reports `queued` / `processing`
  progress through a callback the status bar uses.

## Phases

| Phase | Person 1 | Person 2 |
|---|---|---|
| **0. Together** | #1 Setup: Vite + React, folders, `useViewState`, `api.js` + `src/mock/` + mock switch | same |
| **1. Skeleton** | #4 FramePlayer on mock data: canvas, preload PNGs, play/pause, speed, epoch scrubber, frame info (date, exposures, artifact warning) | #2 Theme + layout shell (placeholders for Person 1's parts)<br>#6 URL state + copy link<br>#15 Part A: **deploy skeleton to Vercel + domain** (mock data) |
| **2. MVP** | #5 Difference + IR colour modes<br>**Real-backend test** (last item of #3): frontend against the real backend for one target (notebook example or WISE 0855) | #3 API client: real calls, 202 queued/processing polling, 429/503 retry, status bar ("waking up server…", queued #n, progress)<br>#7 SearchBar (name → `/resolve`, coordinates, target list)<br>#9 ControlPanel (FOV, detector, stretch) |
| **3. Core** | #8 Overlays: Gaia circles, asteroid labels, click a dot → `selected`<br>#10 "Is it new?" panel (verdict + explain text + links)<br>#11 Charts: spectrum (ice lines), motion track, light curve | #12 SkyMap (Aladin Lite)<br>#13 Start page (hero, 5 target cards, how it works)<br>**Backup:** take the light-curve tab of #11 if Person 1 slips |
| **4. Extras** | Flag overlay (#8), "Report candidate" button (#10), RGB polish | Wavelength slider (#9) with "6 of 14 exposures used"<br>WISE toggle (#12)<br>#14 Embed mode (`?embed=1` + iframe snippet)<br>#15 Part B: **point Vercel at the Hugging Face backend**, mock off |
| **5. Freeze + submit** | Test all 5 targets live, fix visual bugs<br>#16 Polish: keyboard + `aria-label`s, phone width, README GIFs | #17 README text, demo video, Space Apps submission text + project page |

Feature freeze at the start of phase 5: bug fixes only after that.
Phase 5 needs real time: plan **at least a few hours** for the video and submission, not the last night.

## How we work

- One branch per issue (`fe/4-frame-player`), small PRs, merge into `main` at least twice a day.
- `git pull --rebase origin main` before starting work and before every PR.
- Need something from the other person's area? Use a placeholder (grey box, fake function), don't edit their files.
- End of each phase: run `main` together (mock mode, then real backend once it's up) and check everything fits.

## Dependencies on the backend team (agree dates now)

| We need | For | Date |
|---|---|---|
| `phase0_check` passing on real data, `/frames` + `/diff` working locally | Real-backend test (Person 1, phase 2) | _TBD_ |
| Final JSON shapes (or mock responses) for `/context`, `/explain`, `/track`, `/spectrum`, `/lightcurve`, `/rgb` | #8, #10, #11, #5 | _TBD_ |
| Backend live on Hugging Face Spaces + CORS allowing our Vercel domain | #15 Part B (Person 2) | _TBD_ |

The real-backend test doesn't repeat the backend team's IRSA testing. It only checks that the
frontend works end to end with real data.

## Check now, not at the end

- [ ] Space Apps 2026 deadline (date + time zone)
- [ ] Video rules (max length, format, where to upload)
- [ ] Project page / submission form fields
- [ ] Domain claimed from the GoDaddy offer (DNS can take hours)
