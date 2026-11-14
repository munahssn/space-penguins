import "./layout.css";

/** Page frame: header, optional status bar, then viewer column + side panel (stacks on phone width). */
export default function AppLayout({ header, statusBar, viewer, side }) {
  return (
    <div className="app">
      {header}
      {statusBar}
      <main className="app-main">
        <section className="app-viewer" aria-label="Viewer">{viewer}</section>
        <aside className="app-side" aria-label="Details">{side}</aside>
      </main>
    </div>
  );
}
