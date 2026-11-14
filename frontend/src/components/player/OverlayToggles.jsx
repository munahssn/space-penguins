// Checkboxes to show/hide each overlay. A swatch next to each one shows its colour on the image.
import { OVERLAYS } from "./constants.js";

/**
 * @param {{value: Record<string, boolean>, onChange: (id: string, on: boolean) => void,
 *          unavailable?: Record<string, string>}} props   unavailable: id → reason (shown as tooltip)
 */
export default function OverlayToggles({ value, onChange, unavailable = {} }) {
  return (
    <fieldset className="fp-overlays">
      <legend className="fp-visually-hidden">Overlays</legend>
      {OVERLAYS.map(({ id, label }) => (
        <label key={id} className="fp-overlay-toggle" title={unavailable[id]}>
          <input
            type="checkbox"
            checked={value[id] && !unavailable[id]}
            disabled={Boolean(unavailable[id])}
            onChange={(e) => onChange(id, e.target.checked)}
          />
          <span className={`fp-overlay-swatch fp-overlay-swatch--${id}`} aria-hidden="true" />
          {label}
        </label>
      ))}
    </fieldset>
  );
}
