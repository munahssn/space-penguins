// Explains the colours in the Difference and IR colour views.
import { detectorRange } from "../../api/spherex.js";
import { rangeLabel } from "../controls/options.js";
import { RGB_CHANNELS } from "./constants.js";

function Swatch({ className }) {
  return <span className={`fp-swatch ${className}`} aria-hidden="true" />;
}

/** @param {{firstDate: string, lastDate: string}} props */
export function DiffLegend({ firstDate, lastDate }) {
  return (
    <div className="fp-legend">
      <p className="fp-legend-title">Newest pass ({lastDate}) minus first pass ({firstDate})</p>
      <ul className="fp-legend-items">
        <li><Swatch className="fp-swatch--before" />was here</li>
        <li><Swatch className="fp-swatch--after" />is here now</li>
      </ul>
      <p className="fp-legend-note">
        Anything that stayed put cancels out. Something that moved shows up as a blue and red pair.
      </p>
    </div>
  );
}

export function RgbLegend() {
  return (
    <div className="fp-legend">
      <p className="fp-legend-title">Infrared colour</p>
      <ul className="fp-legend-items">
        {RGB_CHANNELS.map(({ channel, det }) => (
          <li key={det}>
            <Swatch className={`fp-swatch--${channel.toLowerCase()}`} />
            {channel} = {det} ({rangeLabel(detectorRange(det))})
          </li>
        ))}
      </ul>
      <p className="fp-legend-note">
        Cold objects like brown dwarfs glow most at long wavelengths, so they look red.
      </p>
    </div>
  );
}
