import "./layout.css";

/** Page frame: header on top, viewer column + side panel below (stacks on phone width). */
export default function AppLayout({ header, viewer, side }) {
  return (
    <div className="app">
      {header}
      <main className="app-main">
        <section className="app-viewer" aria-label="Viewer">{viewer}</section>
        <aside className="app-side" aria-label="Details">{side}</aside>
      </main>
    </div>
  );
}
