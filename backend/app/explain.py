"""
Plain-language explanation for the "Is it new?" panel.

The text is built from facts only: the verdict and numbers from /api/context and, when the
data is downloaded, the motion fit from /api/track. The template always works. An LLM may
reword it, but only if configured, within 5 s, and only if it adds no number of its own;
otherwise the template is used.

LLM settings come from environment variables only (never from the repo):
    EXPLAIN_LLM_API_KEY   key; unset = template only
    EXPLAIN_LLM_URL       OpenAI-compatible chat endpoint (default: Groq's free tier)
    EXPLAIN_LLM_MODEL     model name
"""
import hashlib
import json
import os
import re

from astropy.time import Time

from .config import CACHE_DIR

LLM_URL = os.environ.get("EXPLAIN_LLM_URL", "https://api.groq.com/openai/v1/chat/completions")
LLM_MODEL = os.environ.get("EXPLAIN_LLM_MODEL", "llama-3.1-8b-instant")
LLM_TIMEOUT = 5.0
SAME_OBJECT_ARCSEC = 0.5
EXPLAIN_DIR = CACHE_DIR / "explain"

# SIMBAD object types we are likely to meet, in words
OTYPES = {"BD*": "brown dwarf", "*": "star", "PM*": "high proper-motion star", "HPM*": "high proper-motion star",
          "Mi*": "Mira variable star", "V*": "variable star", "Or*": "young variable star (Orion type)",
          "BY*": "flaring red dwarf (BY Dra type)", "Fl*": "flare star", "LP*": "long-period variable star",
          "WD*": "white dwarf", "LM*": "low-mass star", "**": "double or multiple star", "SB*": "binary star",
          "G": "galaxy", "QSO": "quasar", "AGN": "active galaxy", "Y*O": "young stellar object",
          "TT*": "T Tauri star", "PN": "planetary nebula", "IR": "infrared source", "C*": "carbon star"}


def _date(mjd):
    return Time(mjd, format="mjd").iso[:10]


def _otype(t):
    return OTYPES.get(t, f"object of type {t}" if t else "catalogued object")


def facts_from(ctx, track=None, motion_status="not_requested"):
    """The only things the explanation may use. ctx is /api/context's answer, track /api/track's."""
    f = {"date": _date(ctx["query"]["mjd"]), "verdict": ctx["verdict"],
         "match_radius_arcsec": ctx["match_radius_arcsec"], "match": ctx["match"],
         # other objects nearby; one at the same distance as the match is the same object (or its planets)
         # in another catalogue, not a neighbour
         "nearby": [{"name": o["name"], "source": o["source"], "distance_arcsec": o["distance_arcsec"]}
                    for o in ctx["other_matches"]
                    if not ctx["match"] or abs(o["distance_arcsec"] - ctx["match"]["distance_arcsec"]) > SAME_OBJECT_ARCSEC][:2],
         "artifact_warning": "may be an artifact" in ctx["warnings"],
         "unavailable": sorted({w.split(" unavailable")[0] for w in ctx["warnings"] if "unavailable" in w}),
         "motion_status": motion_status, "motion": None}
    if track and track.get("fit"):
        fit = track["fit"]
        total = (fit["pmra"] ** 2 + fit["pmdec"] ** 2) ** 0.5 / 1000
        err = max(fit["pmra_err"], fit["pmdec_err"]) / 1000
        m = {"arcsec_per_year": round(total, 1), "error": round(err, 1), "passes": fit["n_epochs"],
             "years": fit["years"], "saturated": fit.get("saturated", False), "det": track["query"]["det"]}
        if track.get("compare") and track.get("catalog_pm"):
            cat = track["catalog_pm"]
            m["catalog_arcsec_per_year"] = round((cat["pmra"] ** 2 + cat["pmdec"] ** 2) ** 0.5 / 1000, 1)
            m["sigma"] = max(s for s in (track["compare"]["pmra_sigma"], track["compare"]["pmdec_sigma"]) if s is not None)
        f["motion"] = m
    elif track is not None:
        found = sum(1 for p in track["measured"] if p.get("detected"))
        f["motion_status"] = "too_few_detections"
        f["motion_detected_passes"] = found
    return f


def template(f):
    """Plain English from the facts. Every number in it comes from `f`."""
    m, s = f["match"], []
    r = f["match_radius_arcsec"]
    if f["verdict"] == "known_star":
        g = f" (G = {m['gmag']:.1f})" if m.get("gmag") is not None else ""
        s.append(f"This is a known star: {m['name']}{g}, {m['distance_arcsec']:.1f}\" from this position "
                 f"once its catalogue position is moved to {f['date']} with its proper motion.")
    elif f["verdict"] == "known_asteroid":
        s.append(f"This is most likely the solar-system object {m['name']} ({m['type']}), which SkyBoT puts "
                 f"{m['distance_arcsec']:.1f}\" from here on {f['date']}. Asteroids and comets move from "
                 f"night to night, so it will be somewhere else in other frames.")
    elif f["verdict"] == "known_other":
        s.append(f"This matches {m['name']}, a {_otype(m['type'])} listed in SIMBAD, "
                 f"{m['distance_arcsec']:.1f}\" away once its proper motion is applied for {f['date']}.")
    elif f["verdict"] == "unknown":
        u = f["unavailable"]
        names = u[0] if len(u) == 1 else ", ".join(u[:-1]) + " and " + u[-1]
        s.append(f"No match was found, but {names} could not be reached, so this "
                 f"cannot be called unexplained yet. Please try again later.")
    else:
        s.append(f"No Gaia star, known asteroid or SIMBAD object lies within {r:.1f}\" (about 2 SPHEREx pixels) "
                 f"of this position on {f['date']}. That alone does not make it a discovery: check that it "
                 f"shows up in more than one frame and is not an artifact.")
    if f["nearby"]:
        n = f["nearby"][0]
        s.append(f"{n['name']} ({n['source']}) is also {n['distance_arcsec']:.1f}\" away; SPHEREx pixels are "
                 f"6.2\" wide, so the two can blend together.")
    if f["artifact_warning"]:
        s.append("This frame has many pixels hit by artifacts (ghosts, halos, streaks), so it could also be one of those.")
    mo = f["motion"]
    if mo:
        where = "all detectors" if mo["det"] == "all" else f"detector {mo['det']}"
        line = (f"In SPHEREx data ({where}) it moves {mo['arcsec_per_year']:.1f}\" per year "
                f"(\u00b1{mo['error']:.1f}\"), measured in {mo['passes']} survey passes over {mo['years']:.2f} years.")
        if "catalog_arcsec_per_year" in mo:
            line += (f" The catalogue value is {mo['catalog_arcsec_per_year']:.1f}\" per year; "
                     + (f"the two agree within {mo['sigma']:.1f} times the error." if mo["sigma"] <= 3
                        else f"they differ by {mo['sigma']:.1f} times the error."))
        if mo["saturated"]:
            line += " The star saturates the detector, so these positions are less precise."
        s.append(line)
    elif f["motion_status"] == "too_few_detections":
        s.append(f"Its motion could not be measured: it was found in only {f['motion_detected_passes']} "
                 f"survey pass(es), and at least 2 are needed.")
    elif f["motion_status"] == "pending":
        s.append("Its motion is still being measured: the SPHEREx data for this spot is downloading. Ask again in a minute.")
    return " ".join(s)


_NUM = re.compile(r"\d+(?:\.\d+)?")


def _numbers(text):
    return set(_NUM.findall(text.replace(",", "")))


def llm_reword(text, f, api_key=None):
    """Ask an LLM to make `text` friendlier. Returns the new text, or None on any problem:
    no key, timeout, HTTP error, or a reply containing a number that is not in the template."""
    import requests

    api_key = api_key or os.environ.get("EXPLAIN_LLM_API_KEY")
    if not api_key:
        return None
    prompt = ("Rewrite this explanation for a member of the public in 2-4 friendly sentences. Use ONLY the "
              "facts given. Do not add any fact, number, name or claim that is not in them. Keep every number "
              f"exactly as written.\n\nFacts (JSON): {json.dumps(f)}\n\nExplanation: {text}")
    try:
        r = requests.post(LLM_URL, timeout=LLM_TIMEOUT,
                          headers={"Authorization": f"Bearer {api_key}"},
                          json={"model": LLM_MODEL, "temperature": 0.2, "max_tokens": 300,
                                "messages": [{"role": "user", "content": prompt}]})
        r.raise_for_status()
        out = r.json()["choices"][0]["message"]["content"].strip()
    except Exception:
        return None
    if not out or not _numbers(out) <= _numbers(text):   # it invented or changed a number
        return None
    return out


def explain(f):
    """{text, source} for the facts; cached on disk by a hash of the facts."""
    use_llm = bool(os.environ.get("EXPLAIN_LLM_API_KEY"))
    key = hashlib.sha1(json.dumps([f, use_llm and LLM_MODEL], sort_keys=True).encode()).hexdigest()[:24]
    path = EXPLAIN_DIR / f"{key}.json"
    if path.exists():
        return json.loads(path.read_text())
    text = template(f)
    out = {"text": text, "source": "template"}
    if use_llm:
        better = llm_reword(text, f)
        if better:
            out = {"text": better, "source": "llm"}
    if f["motion_status"] != "pending" and not f["unavailable"]:   # do not keep half answers
        EXPLAIN_DIR.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(out))
    return out
