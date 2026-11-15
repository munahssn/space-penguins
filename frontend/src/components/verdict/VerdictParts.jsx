// The small pieces of the "Is it new?" panel. Each is presentational: data in, markup out.
import { useId } from "react";
import { externalLinks } from "./externalLinks.js";
import { formatMotion, totalMotion, verdictInfo } from "./verdicts.js";

/** "Known star" / "Unexplained" label. */
export function VerdictBadge({ verdict }) {
  const { label, tone } = verdictInfo(verdict);
  return <span className={`verdict-badge verdict-badge--${tone}`}>{label}</span>;
}

/**
 * Shown while the catalogues are checked: grey blocks the size of the answer, shimmering unless motion is
 * reduced, plus a line that screen readers announce.
 */
export function CheckingPlaceholder() {
  return (
    <div className="verdict-checking">
      <p className="verdict-muted" role="status">Checking Gaia, SIMBAD and the known asteroids…</p>
      <div className="verdict-skeleton" aria-hidden="true">
        <span className="skeleton verdict-skeleton-line" />
        <span className="skeleton verdict-skeleton-line verdict-skeleton-line--short" />
        <div className="verdict-stats">
          <span className="skeleton verdict-skeleton-stat" />
          <span className="skeleton verdict-skeleton-stat" />
        </div>
      </div>
    </div>
  );
}

/** Warnings from the backend, e.g. "may be an artifact". */
export function Warnings({ warnings }) {
  if (!warnings?.length) return null;
  return (
    <ul className="verdict-warnings" role="note">
      {warnings.map((warning) => <li key={warning}>⚠ {warning}</li>)}
    </ul>
  );
}

/**
 * Plain-language text: our template at once, replaced by /api/explain's text when it arrives.
 * @param {{template: string, explain: {text: string, source: string}|null}} props
 */
export function Explanation({ template, explain }) {
  const text = explain?.text || template;
  return (
    <div className="verdict-text">
      <p>{text}</p>
      {explain?.source === "llm" && (
        <p className="verdict-note">Worded by an AI model, from the facts in this panel only.</p>
      )}
    </div>
  );
}

/** swatch: which chart series this number is (same colours as the Motion chart). */
function MotionValue({ label, motion, emptyText, swatch }) {
  return (
    <div className="verdict-stat">
      <span className="verdict-stat-label">
        <span className={`verdict-swatch verdict-swatch--${swatch}`} aria-hidden="true" />
        {label}
      </span>
      <span className="verdict-stat-value">{motion === null ? emptyText : formatMotion(motion)}</span>
    </div>
  );
}

/**
 * Catalog motion vs. what we measured in the SPHEREx frames.
 * @param {{track: {catalog_pm?: object, fit?: object}|null, loading: boolean}} props
 */
export function MotionComparison({ track, loading }) {
  const catalog = totalMotion(track?.catalog_pm);
  const measured = totalMotion(track?.fit);
  const emptyText = loading ? "…" : "—";
  const difference = catalog && measured !== null ? Math.abs(measured - catalog) / catalog : null;

  return (
    <div className="verdict-motion">
      <div className="verdict-stats">
        <MotionValue label="Catalogue says" motion={catalog} emptyText={emptyText} swatch="catalog" />
        <MotionValue label="We measured" motion={measured} emptyText={emptyText} swatch="measured" />
      </div>
      {difference !== null && (
        <p className="verdict-note">That's {(difference * 100).toFixed(0)}% off the catalogue value.</p>
      )}
    </div>
  );
}

/** Links to the same position in SIMBAD, WiseView and the Legacy Survey. */
export function ExternalLinks({ position }) {
  const labelId = useId();
  return (
    <div className="verdict-links-row">
      <span id={labelId} className="verdict-links-label">Look it up:</span>
      <ul className="verdict-links" aria-labelledby={labelId}>
        {externalLinks(position).map(({ name, url, what }) => (
          <li key={name}>
            <a href={url} target="_blank" rel="noreferrer" title={what}>{name} ↗</a>
          </li>
        ))}
      </ul>
    </div>
  );
}
