// Blink / Difference / IR colour switch above the player.
import { DISPLAYS } from "./constants.js";

/**
 * @param {{value: string, onChange: (id: string) => void, disabled?: Record<string, string>}} props
 *   disabled: id → reason, e.g. { diff: "Needs at least two passes" }
 */
export default function DisplaySwitch({ value, onChange, disabled = {} }) {
  return (
    <div className="fp-display" role="group" aria-label="What to show">
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
  );
}
