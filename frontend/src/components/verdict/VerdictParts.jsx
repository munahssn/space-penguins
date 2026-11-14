// The small pieces of the "Is it new?" panel. Each is presentational: data in, markup out.
import { externalLinks } from "./externalLinks.js";
import { formatMotion, totalMotion, verdictInfo } from "./verdicts.js";

/** "Known star" / "Unexplained" pill. */
export function VerdictBadge({ verdict }) {
  const { label, tone } = verdictInfo(verdict);
  return <span className={`verdict-badge verdict-badge--${tone}`}>{label}</span>;
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

function MotionValue({ label, motion, emptyText }) {
  return (
    <div className="verdict-stat">
      <span className="verdict-stat-label">{label}</span>
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
        <MotionValue label="Catalog motion" motion={catalog} emptyText={emptyText} />
        <MotionValue label="Measured here" motion={measured} emptyText={emptyText} />
      </div>
      {difference !== null && (
        <p className="verdict-note">Our measurement is {(difference * 100).toFixed(0)}% off the catalog value.</p>
      )}
    </div>
  );
}

/** Links to the same position in SIMBAD, WiseView and the Legacy Survey. */
export function ExternalLinks({ position }) {
  return (
    <ul className="verdict-links">
      {externalLinks(position).map(({ name, url, what }) => (
        <li key={name}>
          <a href={url} target="_blank" rel="noreferrer" title={what}>{name} ↗</a>
        </li>
      ))}
    </ul>
  );
}
