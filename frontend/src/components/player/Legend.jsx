// Explains the colours in the Difference and IR colour views.
import { RGB_CHANNELS } from "./constants.js";

function Swatch({ className }) {
  return <span className={`fp-swatch ${className}`} aria-hidden="true" />;
}

/** @param {{firstDate: string, lastDate: string}} props */
export function DiffLegend({ firstDate, lastDate }) {
  return (
    <div className="fp-legend">
      <p className="fp-legend-title">Last pass ({lastDate}) − first pass ({firstDate})</p>
      <ul className="fp-legend-items">
        <li><Swatch className="fp-swatch--before" />was here</li>
        <li><Swatch className="fp-swatch--after" />is here now</li>
      </ul>
      <p className="fp-legend-note">
        Anything that stayed put cancels out. A moving object shows up as a blue–red pair.
      </p>
    </div>
  );
}

export function RgbLegend() {
  return (
    <div className="fp-legend">
      <p className="fp-legend-title">Infrared colour</p>
      <ul className="fp-legend-items">
        {RGB_CHANNELS.map(({ channel, det, range }) => (
          <li key={det}>
            <Swatch className={`fp-swatch--${channel.toLowerCase()}`} />
            {channel} = {det} ({range})
          </li>
        ))}
      </ul>
      <p className="fp-legend-note">
        Cold objects like brown dwarfs glow most at long wavelengths, so they look red.
      </p>
    </div>
  );
}
