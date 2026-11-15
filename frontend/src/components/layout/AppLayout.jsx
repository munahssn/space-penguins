import "./layout.css";

/**
 * Viewer page frame: header and status bar on top, then the player column with more detail under it
 * (`below`) and the black side panel on the right. On narrow screens the side panel moves between the
 * two, so settings and the verdict stay close to the image.
 */
export default function AppLayout({ header, statusBar, viewer, below, side }) {
  return (
    <div className="app">
      {header}
      {statusBar}
      <main className="app-main">
        <section className="app-viewer" aria-label="Viewer">{viewer}</section>
        {below && <section className="app-below" aria-label="Charts and sky map">{below}</section>}
        <aside className="app-side" aria-label="Target and settings">{side}</aside>
      </main>
    </div>
  );
}
