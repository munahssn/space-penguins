import { DEFAULTS, buildShareUrl } from "../../hooks/useViewState.jsx";
import { useTargets } from "../search/useTargets.js";

/** Which test targets get a card, and their tag. Backend target ids (see /api/targets). */
const TARGET_KINDS = {
  barnard: "moves",
  "eps-indi-b": "moves",
  wise0855: "moves",
  "rw-aur": "brightness",
  "r-dra": "brightness",
};
const KIND_LABELS = { moves: "Moves", brightness: "Changes brightness" };
const CARD_COUNT = Object.keys(TARGET_KINDS).length;

const viewerUrl = (target) => buildShareUrl({ ...DEFAULTS, ra: target.ra, dec: target.dec });
const formatPosition = (target) => `RA ${target.ra.toFixed(4)}° · Dec ${target.dec.toFixed(4)}°`;

function TargetCard({ target }) {
  const kind = TARGET_KINDS[target.id];
  return (
    <li>
      <a className="target-card" href={viewerUrl(target)}>
        <span className={`target-tag target-tag--${kind}`}>{KIND_LABELS[kind]}</span>
        <h3>{target.name}</h3>
        <p>{target.note}</p>
        <span className="target-position">{formatPosition(target)}</span>
        <span className="target-open" aria-hidden="true">Open in viewer →</span>
      </a>
    </li>
  );
}

/** The challenge's test targets as cards linking to the viewer. Grey placeholders until they load. */
export default function TargetCards() {
  const targets = useTargets().filter((t) => t.id in TARGET_KINDS);
  const loading = targets.length === 0;

  return (
    <ul className="target-cards" aria-busy={loading}>
      {loading
        ? Array.from({ length: CARD_COUNT }, (_, i) => <li key={i} className="target-card target-card--loading" />)
        : targets.map((t) => <TargetCard key={t.id} target={t} />)}
    </ul>
  );
}
