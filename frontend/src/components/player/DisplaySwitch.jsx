// Blink / Difference / IR colour switch above the player, with a line saying what the chosen view shows.
import { useId } from "react";
import { DISPLAYS } from "./constants.js";

/**
 * @param {{value: string, onChange: (id: string) => void, disabled?: Record<string, string>}} props
 *   disabled: id → reason, e.g. { diff: "Needs at least two passes" }
 */
export default function DisplaySwitch({ value, onChange, disabled = {} }) {
  const hintId = useId();
  const current = DISPLAYS.find((d) => d.id === value);

  return (
    <div className="fp-display-wrap">
      <div className="fp-display" role="group" aria-label="What to show" aria-describedby={hintId}>
        {DISPLAYS.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            aria-pressed={id === value}
            disabled={Boolean(disabled[id])}
            title={disabled[id]}
            onClick={() => onChange(id)}
          >
            {label}
          </button>
        ))}
      </div>
      <p id={hintId} className="fp-display-hint">{current?.hint}</p>
    </div>
  );
}
