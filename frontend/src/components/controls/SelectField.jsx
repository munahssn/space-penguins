import { useId } from "react";
import FieldLabel from "./FieldLabel.jsx";
import { withCurrentValue } from "./options.js";

/**
 * Labelled <select>. Option values may be numbers or strings; onChange gets the original value back.
 * A value that isn't one of the options is shown as an extra option (see withCurrentValue).
 */
export default function SelectField({ label, hint, value, options, onChange, formatExtra }) {
  const id = useId();
  const all = withCurrentValue(options, value, formatExtra);

  function handleChange(event) {
    const picked = all.find((o) => String(o.value) === event.target.value);
    if (picked) onChange(picked.value);
  }

  return (
    <div className="field">
      <FieldLabel as="label" htmlFor={id} label={label} hint={hint} />
      <select id={id} value={String(value)} onChange={handleChange}>
        {all.map((o) => (
          <option key={String(o.value)} value={String(o.value)}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}
