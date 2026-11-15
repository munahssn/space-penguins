import { useState } from "react";
import { DEFAULTS, buildShareUrl } from "../../hooks/useViewState.jsx";
import { POPULAR_FINDS, useTargets } from "../search/useTargets.js";
import { formatPosition, sentenceCase } from "../target/format.js";

/** Tag text for what each popular find is known for. */
const KIND_LABELS = { moves: "Moves", brightness: "Changes brightness" };
const CARD_COUNT = Object.keys(POPULAR_FINDS).length;

const viewerUrl = (target) => buildShareUrl({ ...DEFAULTS, ra: target.ra, dec: target.dec });
/** "T-01": a small catalogue-style number, decoration only. */
const cardCode = (i) => `T-${String(i + 1).padStart(2, "0")}`;

/** Picture for each card: public/images/targets/<target id>.jpg. Until a file is there, the frame shows stars. */
const imageUrl = (target) => `/images/targets/${target.id}.jpg`;

function TargetImage({ target }) {
  const [missing, setMissing] = useState(false);
  return (
    <span className="target-card-image">
      {!missing && <img src={imageUrl(target)} alt="" loading="lazy" onError={() => setMissing(true)} />}
    </span>
  );
}

function TargetCard({ target, index }) {
  const kind = POPULAR_FINDS[target.id];
  return (
    <li className="target-card-item">
      <a className="target-card" href={viewerUrl(target)}>
        <TargetImage target={target} />
        <span className="target-card-top">
          <span className={`target-tag target-tag--${kind}`}>{KIND_LABELS[kind]}</span>
          <span aria-hidden="true">{cardCode(index)}</span>
        </span>
        <h3>
          {target.name}
          <span className="target-arrow" aria-hidden="true">
            <svg viewBox="0 0 12 12"><path d="M2 6h7M6 2.5 9.5 6 6 9.5" /></svg>
          </span>
        </h3>
        <p>{sentenceCase(target.note)}</p>
        <span className="target-position">{formatPosition(target.ra, target.dec)}</span>
      </a>
    </li>
  );
}

/** The popular finds as picture cards linking to the viewer. Grey placeholders until they load. */
export default function TargetCards() {
  const targets = useTargets();
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
