// Start page: everything the viewer can do, one short line each, with a simple line icon.

/** 24×24 stroke icons. Decorative: the title next to each says what it is. */
const ICONS = {
  blink: <><rect x="3" y="5" width="12" height="12" /><rect x="9" y="9" width="12" height="12" /></>,
  diff: <><circle cx="9" cy="12" r="5" /><circle cx="15" cy="12" r="5" /></>,
  colour: <><path d="M4 18 12 4l8 14z" /><path d="m8 18 4-7 4 7" /></>,
  overlays: <><circle cx="12" cy="12" r="7" /><circle cx="12" cy="12" r="2" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3" /></>,
  verdict: <><circle cx="11" cy="11" r="6" /><path d="m16 16 5 5" /></>,
  charts: <><path d="M3 20h18" /><path d="m5 16 4-5 4 3 6-8" /></>,
  bands: <><path d="M4 6h16M4 12h16M4 18h16" /><circle cx="9" cy="6" r="1.5" /><circle cx="15" cy="12" r="1.5" /><circle cx="7" cy="18" r="1.5" /></>,
  share: <><path d="m10 14 4-4" /><path d="m8 11-2 2a3 3 0 0 0 4 4l2-2" /><path d="m16 13 2-2a3 3 0 0 0-4-4l-2 2" /></>,
};

const FEATURES = [
  { icon: "blink", title: "Blink", text: "Plays one image per survey pass. Anything that moves or changes brightness jumps out." },
  { icon: "diff", title: "Difference", text: "Subtracts the first pass from the newest. Blue shows where something was, red where it is now." },
  { icon: "colour", title: "IR colour", text: "Puts three bands into red, green and blue, so cold objects like brown dwarfs look red." },
  { icon: "overlays", title: "Overlays", text: "Shows known stars, known asteroids and bad pixels on top of the image." },
  { icon: "verdict", title: "Is it new?", text: "Click any dot. We check Gaia, SIMBAD and the known asteroids, then compare its motion with the catalogue." },
  { icon: "charts", title: "Charts", text: "See the spectrum, the motion and the brightness over time for any spot you pick." },
  { icon: "bands", title: "Wavelength and zoom", text: "Choose one of six detectors or narrow the band, and zoom from 3′ to 30′." },
  { icon: "share", title: "Share and embed", text: "Every view has its own link. Copy it, or put the player on another page." },
];

export default function FeatureGrid() {
  return (
    <ul className="feature-grid">
      {FEATURES.map(({ icon, title, text }) => (
        <li key={title} className="feature">
          <span className="feature-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">{ICONS[icon]}</svg>
          </span>
          <div className="feature-body">
            <h3>{title}</h3>
            <p>{text}</p>
          </div>
        </li>
      ))}
    </ul>
  );
}
