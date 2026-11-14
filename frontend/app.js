// SPHEREx Blink frontend (Phase 0 starter). Talks to the API in docs/API.md.
// Same origin when served by the backend; change this if the API lives elsewhere.
const API = "";

const $ = (id) => document.getElementById(id);
const state = { frames: [], i: 0, timer: null, diffOn: false, diffImg: null, query: null };

// ---------- URL state (so views can be shared / embedded) ----------
function readUrl() {
  const p = new URLSearchParams(location.search);
  for (const k of ["ra", "dec", "fov", "det"]) if (p.has(k)) $(k).value = p.get(k);
  return p.has("ra") && p.has("dec");
}
function writeUrl(q) {
  history.replaceState(null, "", "?" + new URLSearchParams(q).toString());
}

// ---------- API ----------
async function api(path, params) {
  const res = await fetch(`${API}${path}?${new URLSearchParams(params)}`);
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.detail || `HTTP ${res.status}`);
  return body;
}

async function loadTargets() {
  const [health, targets] = await Promise.all([fetch(`${API}/api/health`).then(r => r.json()),
                                               fetch(`${API}/api/targets`).then(r => r.json())]);
  $("status").textContent = health.mock ? "mock data" : `data release: ${health.release}`;
  for (const t of targets) {
    const o = document.createElement("option");
    o.value = JSON.stringify(t);
    o.textContent = t.name;
    $("target").append(o);
  }
}

async function load() {
  const q = { ra: $("ra").value, dec: $("dec").value, fov: $("fov").value, det: $("det").value };
  writeUrl(q);
  stop();
  setBusy(true, "Fetching SPHEREx images… (first load of a new spot can take a minute)");
  try {
    const data = await api("/api/frames", q);
    state.frames = data.frames;
    state.query = q;
    state.i = 0;
    state.diffOn = false;
    state.diffImg = null;
    $("slider").max = data.frames.length - 1;
    show(0);
    setBusy(false, `${data.frames.length} epochs · ${data.grid.width}×${data.grid.height} px · ${data.grid.pixscale_arcsec.toFixed(2)}″/px`);
    if (data.frames.length > 1) play();
  } catch (e) {
    setBusy(false, `Error: ${e.message}`);
  }
}

// ---------- player ----------
function show(i) {
  const f = state.frames[i];
  if (!f) return;
  state.i = i;
  $("frame").src = f.image;
  $("slider").value = i;
  $("frameinfo").textContent =
    `${f.date} · ${f.n_exposures} exposures stacked · ${(f.flagged_fraction * 100).toFixed(1)}% bad pixels` +
    (f.artifact_fraction > 0.02 ? ` · ⚠ ${(f.artifact_fraction * 100).toFixed(1)}% artifacts (ghosts/halos)` : "");
}
function play() {
  stop();
  state.timer = setInterval(() => show((state.i + 1) % state.frames.length), +$("speed").max + 100 - +$("speed").value);
  $("play").textContent = "Pause";
}
function stop() {
  clearInterval(state.timer);
  state.timer = null;
  $("play").textContent = "Play";
}

async function toggleDiff() {
  if (state.diffOn) {
    state.diffOn = false;
    $("diff").textContent = "Difference";
    show(state.i);
    return;
  }
  stop();
  if (!state.diffImg) {
    const d = await api("/api/diff", { ...state.query, a: 0, b: state.frames.length - 1, op: "sub" });
    state.diffImg = d.image;
  }
  state.diffOn = true;
  $("frame").src = state.diffImg;
  $("diff").textContent = "Back to blink";
  $("frameinfo").textContent = "Last − first epoch · red = brighter now, blue = brighter before";
}

function setBusy(busy, msg) {
  for (const id of ["play", "slider", "diff"]) $(id).disabled = busy || state.frames.length < 2;
  $("frameinfo").textContent = msg || "";
}

// ---------- wiring ----------
$("search").addEventListener("submit", (e) => { e.preventDefault(); load(); });
$("target").addEventListener("change", (e) => {
  if (!e.target.value) return;
  const t = JSON.parse(e.target.value);
  $("ra").value = t.ra;
  $("dec").value = t.dec;
  load();
});
$("play").addEventListener("click", () => (state.timer ? stop() : play()));
$("slider").addEventListener("input", (e) => { stop(); show(+e.target.value); });
$("speed").addEventListener("input", () => state.timer && play());
$("diff").addEventListener("click", toggleDiff);

loadTargets().catch(() => ($("status").textContent = "API not reachable: is the backend running?"));
if (readUrl()) load();
