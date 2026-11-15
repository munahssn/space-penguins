import { DEFAULTS, buildShareUrl } from "../../hooks/useViewState.jsx";
import { useTargets } from "../search/useTargets.js";
import { formatDeg, sentenceCase } from "../target/format.js";

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
/** "T-01": a small catalogue-style number, decoration only. */
const cardCode = (i) => `T-${String(i + 1).padStart(2, "0")}`;

function TargetCard({ target, index }) {
  const kind = TARGET_KINDS[target.id];
  return (
    <li className="target-card-item">
      <a className="target-card" href={viewerUrl(target)}>
        <span className="target-card-top">
          <span className={`target-tag target-tag--${kind}`}>{KIND_LABELS[kind]}</span>
          <span aria-hidden="true">{cardCode(index)}</span>
        </span>
        <h3>{target.name}</h3>
        <p>{sentenceCase(target.note)}</p>
        <dl className="target-position">
          <div><dt>RA</dt><dd>{formatDeg(target.ra)}</dd></div>
          <div><dt>Dec</dt><dd>{formatDeg(target.dec, { signed: true })}</dd></div>
        </dl>
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
        ? Array.from({ length: CARD_COUNT }, (_, i) => (
          <li key={i} className="target-card-item">
            <span className="target-card-placeholder skeleton" />
          </li>
        ))
        : targets.map((t, i) => <TargetCard key={t.id} target={t} index={i} />)}
    </ul>
  );
}
