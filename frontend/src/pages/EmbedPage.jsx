// Embed mode (#14): what an <iframe> with ?embed=1 shows. Only the player (with its own controls),
// the status bar for "waking up…" messages, and a link to the full app.
import FramePlayer from "../components/player/FramePlayer.jsx";
import StatusBar from "../components/status/StatusBar.jsx";
import { useViewState } from "../hooks/useViewState.jsx";
import "./embed.css";

export default function EmbedPage() {
  const { ra, dec, shareUrl } = useViewState();
  const hasTarget = ra !== null && dec !== null;

  return (
    <div className="embed">
      <StatusBar />
      <main className="embed-main">
        <h1 className="visually-hidden">SPHEREx Blink player</h1>
        {hasTarget ? (
          <FramePlayer />
        ) : (
          <p className="embed-empty">This embed link has no target. Add ?ra=…&dec=… to the address.</p>
        )}
      </main>
      <footer className="embed-footer">
        <a className="embed-open" href={shareUrl()} target="_blank" rel="noopener noreferrer">
          Open in SPHEREx Blink ↗
        </a>
      </footer>
    </div>
  );
}
