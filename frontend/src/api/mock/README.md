# Mock responses

One JSON file per endpoint, in the shapes from `docs/DESIGN.md` §6.
`src/api/api.js` returns these when `VITE_USE_MOCK=true`.

- Images (`url` fields) point at SVGs in `frontend/public/mock/`. A real backend returns PNG URLs instead;
  both load the same way in `<img>` or `canvas.drawImage`.
- `getFrames` / `getDiff` / `getRgb` also fake a short "queued → processing" phase so the status bar
  can be built without the backend.
- Changing a shape? Update `docs/DESIGN.md`, this folder, and tell the backend team, in the same PR.
