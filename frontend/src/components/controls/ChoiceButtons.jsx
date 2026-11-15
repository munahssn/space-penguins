import { useId } from "react";

/**
 * A short row of buttons where exactly one is on (zoom, brightness). Same contract as SelectField:
 * option values may be numbers or strings, and a value that isn't an option (e.g. fov=0.15 from a
 * shared link) gets a button of its own so the current state is always visible.
 * @param {{label: string, hint?: string, value: any, options: {value: any, label: string}[],
 *          onChange: (value: any) => void, formatExtra?: (value: any) => string}} props
 */
export default function ChoiceButtons({ label, hint, value, options, onChange, formatExtra = String }) {
  const labelId = useId();
  const known = options.some((o) => o.value === value);
  const all = known ? options : [{ value, label: formatExtra(value) }, ...options];

  return (
    <div className="field">
      <span id={labelId} className="field-label">
        {label}
        {hint && <span className="field-hint"> · {hint}</span>}
      </span>
      <div className="choice-buttons" role="group" aria-labelledby={labelId}>
        {all.map((o) => (
          <button
            key={String(o.value)}
            type="button"
            aria-pressed={o.value === value}
            onClick={() => onChange(o.value)}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}
