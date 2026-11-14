// The blink player (#4): fetches the frames for the current view, preloads them, and plays them
// on a pixelated canvas with controls, frame info and a scale bar.
//
// Reads the view from useViewState(), so it needs no props: <FramePlayer />
// Keyboard (when focused): Space = play/pause, ←/→ = previous/next frame.
//
// Not yet: difference / IR colour (#5), overlays + click to select (#8).
import { useViewState } from "../../hooks/useViewState.jsx";
import FrameCanvas from "./FrameCanvas.jsx";
import FrameInfo, { frameLabel } from "./FrameInfo.jsx";
import PlayerControls from "./PlayerControls.jsx";
import ScaleBar from "./ScaleBar.jsx";
import { useFrames } from "./useFrames.js";
import { usePlayback } from "./usePlayback.js";
import { usePreloadedImages } from "./usePreloadedImages.js";
import "./FramePlayer.css";

/** Turns the fetch/preload state into one line for the user, or null when everything is ready. */
function loadingMessage({ loading, progress }, images, frameCount) {
  if (loading) {
    if (progress?.status === "queued") return `Waiting in line (position ${progress.position})…`;
    if (progress?.status === "processing") return `Processing SPHEREx images: ${progress.done} of ${progress.total}…`;
    if (progress?.status === "retrying") return "The archive is busy, trying again…";
    return "Finding SPHEREx images…";
  }
  if (frameCount > 0 && !images.ready) return `Loading frames: ${images.loaded} of ${frameCount}…`;
  return null;
}

/** ApiError carries an HTTP status; anything else (e.g. TypeError "Failed to fetch") means no connection. */
function errorMessage(error) {
  if (error.status) return `Couldn't load frames: ${error.message}`;
  return "Can't reach the server. It may be waking up, so try again in a minute.";
}

function Placeholder({ children, tone = "muted" }) {
  return <div className={`fp-placeholder fp-placeholder--${tone}`}>{children}</div>;
}

export default function FramePlayer() {
  const view = useViewState();
  const result = useFrames(view);
  const { frames, grid, error } = result;

  const images = usePreloadedImages(frames.map((f) => f.url));
  const playback = usePlayback(frames.length, frames);

  if (view.ra === null || view.dec === null) {
    return <Placeholder>Search for an object or pick a test target to start.</Placeholder>;
  }
  if (error) {
    return <Placeholder tone="error">{errorMessage(error)}</Placeholder>;
  }

  const message = loadingMessage(result, images, frames.length);
  if (message) return <Placeholder>{message}</Placeholder>;
  if (frames.length === 0) return <Placeholder>No SPHEREx images cover this position yet.</Placeholder>;

  const { index } = playback;
  const frame = frames[index];
  const label = frameLabel(frame, index, frames.length, view.mode);

  function handleKeyDown(e) {
    const actions = {
      " ": playback.togglePlaying,
      ArrowLeft: () => playback.step(-1),
      ArrowRight: () => playback.step(1),
    };
    const action = actions[e.key];
    if (!action || e.target.closest("button, input")) return; // let buttons/sliders handle their own keys
    e.preventDefault();
    action();
  }

  return (
    <section
      className="fp"
      aria-label="Frame player"
      tabIndex={0}
      onKeyDown={handleKeyDown}
    >
      <FrameCanvas
        image={images.images[index]}
        width={grid.width}
        height={grid.height}
        label={`SPHEREx image, ${label}`}
      >
        <span className="fp-badge">{label}</span>
        <ScaleBar grid={grid} />
      </FrameCanvas>
      <PlayerControls
        frames={frames}
        index={index}
        playing={playback.playing}
        speed={playback.speed}
        onTogglePlay={playback.togglePlaying}
        onPick={playback.goTo}
        onSpeed={playback.setSpeed}
      />
      <FrameInfo frame={frame} index={index} count={frames.length} mode={view.mode} />
    </section>
  );
}
