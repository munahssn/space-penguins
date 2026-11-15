import { useId } from "react";

/**
 * Labelled <select>. Option values may be numbers or strings; onChange gets the original value back.
 * If `value` isn't one of the options (e.g. fov=0.15 from a shared link) it is shown as an extra option.
 */
export default function SelectField({ label, hint, value, options, onChange, formatExtra = String }) {
  const id = useId();
  const known = options.some((o) => o.value === value);
  const all = known ? options : [{ value, label: formatExtra(value) }, ...options];

  function handleChange(event) {
    const picked = all.find((o) => String(o.value) === event.target.value);
    if (picked) onChange(picked.value);
  }

  return (
    <div className="field">
      <label htmlFor={id} className="field-label">
        {label}
        {hint && <span className="field-hint"> · {hint}</span>}
      </label>
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
