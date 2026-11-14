/**
 * Stand-in for a component that isn't built yet, so the layout can be checked early.
 * Replace each <Placeholder> with the real component when its issue lands.
 */
export default function Placeholder({ name, issue, owner, className = "" }) {
  return (
    <div className={`placeholder ${className}`.trim()} role="note">
      <span className="placeholder-name">{name} goes here</span>
      <span className="placeholder-meta">#{issue} · {owner}</span>
    </div>
  );
}
