// Phase 0 check page: shows the view state and lets you call every API function.
// Not part of the product. Delete once the real layout (#2) is in.
import { useState } from "react";
import { useViewState } from "../hooks/useViewState.jsx";
import * as api from "../api/api.js";

export default function DevCheck() {
  const view = useViewState();
  const { ra, dec, fov, det, mode, wmin, wmax, selected, embed, setView, setSelected } = view;
  const [out, setOut] = useState(null);
  const [progress, setProgress] = useState(null);
  const [name, setName] = useState("WISE 0855");

  const pos = { ra: ra ?? 133.768079, dec: dec ?? -7.242922 };
  const calls = {
    getHealth: () => api.getHealth(),
    resolve: () => api.resolve(name),
    getFrames: () => api.getFrames({ ...pos, fov, det, mode, wmin, wmax }, { onProgress: setProgress }),
    getDiff: () => api.getDiff({ ...pos, fov, det, mode, wmin, wmax, a: 0, b: 2 }, { onProgress: setProgress }),
    getRgb: () => api.getRgb({ ...pos, fov }, { onProgress: setProgress }),
    getContext: () => api.getContext({ ...pos, fov, mjd: 60816.4 }),
    getExplain: () => api.getExplain({ ...pos, mjd: 60816.4 }),
    getTrack: () => api.getTrack(pos),
    getSpectrum: () => api.getSpectrum(pos),
    getLightcurve: () => api.getLightcurve({ ...pos, det }),
  };

  async function run(key) {
    setProgress(null);
    setOut({ key, loading: true });
    try {
      const data = await calls[key]();
      if (key === "resolve") setView({ ra: data.ra, dec: data.dec });
      setOut({ key, data });
    } catch (e) {
      setOut({ key, error: `${e.name}: ${e.message}${e.status ? ` (HTTP ${e.status})` : ""}` });
    }
  }

  const images = out?.data?.frames?.map((f) => f.url) ?? (out?.data?.url ? [out.data.url] : []);

  return (
    <main className="dev">
      <h1>SPHEREx Blink · phase 0 check</h1>
      <p className="muted">
        Mode: <b>{api.USE_MOCK ? "mock data (VITE_USE_MOCK=true)" : `real backend at ${api.API_URL}`}</b>
        {embed && " · embed=1"}
      </p>

      <section>
        <h2>useViewState</h2>
        <pre>{JSON.stringify({ ra, dec, fov, det, mode, wmin, wmax, selected, embed }, null, 2)}</pre>
        <div className="row">
          <button onClick={() => setView({ ra: 269.446297, dec: 4.767943 })}>Barnard's Star</button>
          <button onClick={() => setView({ det: det === "D3" ? "D6" : "D3" })}>Toggle det</button>
          <button onClick={() => setView({ mode: mode === "epoch" ? "exposure" : "epoch" })}>Toggle mode</button>
          <button onClick={() => setView({ wmin: 1.5, wmax: 2.5 })}>wmin/wmax 1.5–2.5</button>
          <button onClick={() => setSelected({ ra: pos.ra, dec: pos.dec })}>Select centre</button>
          <button onClick={view.reset}>Reset</button>
        </div>
        <p className="muted">Watch the address bar: everything except <code>selected</code> goes into the URL.</p>
      </section>

      <section>
        <h2>api.js</h2>
        <div className="row">
          <input value={name} onChange={(e) => setName(e.target.value)} aria-label="Name to resolve" />
          {Object.keys(calls).map((k) => (
            <button key={k} onClick={() => run(k)}>{k}</button>
          ))}
        </div>
        {progress && <p className="muted">progress: {JSON.stringify(progress)}</p>}
        {images.length > 0 && (
          <div className="row">
            {images.map((u) => <img key={u} src={u} alt="" className="thumb" />)}
          </div>
        )}
        {out && (
          <pre className={out.error ? "error" : ""}>
            {out.key}: {out.loading ? "loading…" : out.error ?? JSON.stringify(out.data, null, 2)}
          </pre>
        )}
      </section>
    </main>
  );
}
