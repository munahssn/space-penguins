import { useId } from "react";
import FieldLabel from "./FieldLabel.jsx";
import { withCurrentValue } from "./options.js";

/**
 * A short row of buttons where exactly one is on (zoom, brightness). Same contract as SelectField:
 * a value that isn't an option gets a button of its own (see withCurrentValue).
 * @param {{label: string, hint?: string, value: any, options: {value: any, label: string}[],
 *          onChange: (value: any) => void, formatExtra?: (value: any) => string}} props
 */
export default function ChoiceButtons({ label, hint, value, options, onChange, formatExtra }) {
  const labelId = useId();
  const all = withCurrentValue(options, value, formatExtra);

  return (
    <div className="field">
      <FieldLabel as="span" id={labelId} label={label} hint={hint} />
      <div className="choice-buttons" role="group" aria-labelledby={labelId}>
        {all.map((o) => (
          <button
            key={String(o.value)}
            type="button"
            className="toggle"
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
