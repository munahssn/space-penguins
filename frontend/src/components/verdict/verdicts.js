// What each verdict from /api/context means, and the plain sentence we show straight away.
// The backend decides the verdict with rules (backend/app/routers/context.py); nothing here guesses.
import { MAS_PER_ARCSEC } from "../../utils/angles.js";

/** verdict id → badge label + tone (tone picks the colour in verdict.css). */
const VERDICTS = {
  known_star: { label: "Known star", tone: "known" },
  known_asteroid: { label: "Known asteroid", tone: "known" },
  known_other: { label: "Known object", tone: "known" },
  unexplained: { label: "Unexplained", tone: "new" },
};

const UNKNOWN_VERDICT = { label: "Unknown", tone: "muted" };

export function verdictInfo(verdict) {
  return VERDICTS[verdict] ?? UNKNOWN_VERDICT;
}

const SOURCE_NAMES = { gaia: "Gaia DR3", skybot: "SkyBoT", simbad: "SIMBAD" };

const sourceName = (source) => SOURCE_NAMES[String(source).toLowerCase()] ?? source;

/**
 * One sentence from the verdict facts alone, shown immediately (before /api/explain answers).
 * @param {{verdict: string, match: {name: string, type?: string, source?: string}|null}} context
 */
export function templateText({ verdict, match }) {
  if (verdict === "unexplained" || !match) {
    return "Nothing in Gaia or the known-asteroid list matches this spot. "
      + "It could be something new, or an artifact, so check it in every frame.";
  }
  const kind = match.type ? `, a ${match.type}` : "";
  const from = match.source ? ` (${sourceName(match.source)})` : "";
  return `This matches ${match.name}${kind}${from}.`;
}

/** Total proper motion in ″/yr from {pmra, pmdec} in mas/yr, or null if missing. */
export function totalMotion(pm) {
  if (!pm || !Number.isFinite(pm.pmra) || !Number.isFinite(pm.pmdec)) return null;
  return Math.hypot(pm.pmra, pm.pmdec) / MAS_PER_ARCSEC;
}

/** "8.15″/yr" */
export function formatMotion(arcsecPerYear) {
  return `${arcsecPerYear.toFixed(arcsecPerYear < 1 ? 3 : 2)}″/yr`;
}
