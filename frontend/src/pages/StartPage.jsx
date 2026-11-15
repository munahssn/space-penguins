// Start page (#13): shown when the URL has no target. Searching or opening a card switches to the viewer.
// The SPHEREx all-sky map sits behind the header and hero (start.css, .start-page::before).
import Header from "../components/layout/Header.jsx";
import SearchBar from "../components/search/SearchBar.jsx";
import FeatureGrid from "../components/start/FeatureGrid.jsx";
import HowItWorks from "../components/start/HowItWorks.jsx";
import Mission from "../components/start/Mission.jsx";
import StartNav from "../components/start/StartNav.jsx";
import TargetCards from "../components/start/TargetCards.jsx";
import DataChip from "../components/status/DataChip.jsx";
import StatusBar from "../components/status/StatusBar.jsx";
import "../components/start/start.css";

/** A start-page section: a big title, then the content. */
function Section({ id, title, children }) {
  return (
    <section id={id} className="start-section" aria-labelledby={`${id}-title`}>
      <h2 id={`${id}-title`} className="start-section-title">{title}</h2>
      {children}
    </section>
  );
}

export default function StartPage() {
  return (
    <div className="app start-page">
      <Header nav={<StartNav />} status={<DataChip />} />
      <StatusBar />
      {/* Decoration: a launch photo on the right, overlapping the hero and the mission text. */}
      <img className="start-rocket" src="/images/rocket.webp" alt="" aria-hidden="true" />
      <main className="start">
        <section id="search" className="start-hero" aria-labelledby="start-title">
          <div className="start-hero-main">
            <p className="kicker rise">NASA Space Apps 2026 · SPHEREx challenge</p>
            <h1 id="start-title" className="rise rise-1">Catch The Sky<br />In Motion</h1>
            <div className="start-hero-search rise rise-2">
              <SearchBar large />
            </div>
            <p className="start-lead rise rise-3">
              Search and flip through every SPHEREx image of it. Anything that moved or changed
              brightness stands out!
            </p>
          </div>
        </section>

        <Mission />

        <Section id="how" title="Three Steps">
          <HowItWorks />
        </Section>

        <Section id="features" title="Features">
          <FeatureGrid />
        </Section>

        <Section id="popular" title="Check Out Some Well-Known Finds">
          <TargetCards />
        </Section>
      </main>
      <footer className="start-footer">
        <span>Images: NASA SPHEREx via IRSA · Sky maps: Aladin Lite (CDS)</span>
        <span>Catalogues: ESA Gaia · SIMBAD · SkyBoT</span>
        <span>Background: SPHEREx all-sky map, NASA/JPL-Caltech</span>
      </footer>
    </div>
  );
}
