/**
 * "Zoom · how much sky to show": a control's name with an optional short hint after it.
 * `as` is "label" for a single input (with htmlFor) or "span" for a group (referenced by aria-labelledby).
 */
export default function FieldLabel({ as: Tag = "label", label, hint, ...props }) {
  return (
    <Tag className="field-label" {...props}>
      {label}
      {hint && <span className="field-hint"> · {hint}</span>}
    </Tag>
  );
}
