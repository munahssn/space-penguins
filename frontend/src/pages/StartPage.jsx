// Start page (#13): shown when the URL has no target. Searching or opening a card switches to the viewer.
import Header from "../components/layout/Header.jsx";
import SearchBar from "../components/search/SearchBar.jsx";
import HowItWorks from "../components/start/HowItWorks.jsx";
import TargetCards from "../components/start/TargetCards.jsx";
import DataChip from "../components/status/DataChip.jsx";
import StatusBar from "../components/status/StatusBar.jsx";
import "../components/start/start.css";

export default function StartPage() {
  return (
    <div className="app">
      <Header status={<DataChip />} />
      <StatusBar />
      <main className="start">
        <section className="start-hero" aria-labelledby="start-title">
          <p className="start-kicker">NASA Space Apps 2026 · SPHEREx</p>
          <h1 id="start-title">Spot what moves in the infrared sky</h1>
          <p className="start-lead">
            Blink every SPHEREx image of a patch of sky. Brown dwarfs, fast stars and asteroids jump out.
          </p>
          <SearchBar large showTargets={false} />
        </section>

        <section className="start-section" aria-labelledby="targets-title">
          <h2 id="targets-title">Try a test target</h2>
          <TargetCards />
        </section>

        <section className="start-section" aria-labelledby="how-title">
          <h2 id="how-title">How it works</h2>
          <HowItWorks />
        </section>
      </main>
      <footer className="start-footer">
        Data: NASA SPHEREx via IRSA · Sky maps: Aladin Lite (CDS) · Star positions: ESA Gaia
      </footer>
    </div>
  );
}
