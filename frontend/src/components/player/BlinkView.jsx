// Blink: plays the frames one after another so moving things jump out.
// Keyboard (when focused): Space = play/pause, ←/→ = previous/next frame.
import FrameCanvas from "./FrameCanvas.jsx";
import FrameInfo, { frameLabel } from "./FrameInfo.jsx";
import PlayerControls from "./PlayerControls.jsx";
import { PlayerPlaceholder } from "./PlayerStatus.jsx";
import ScaleBar from "./ScaleBar.jsx";
import { usePlayback } from "./usePlayback.js";

/**
 * @param {{frames: object[], grid: object, images: {images: (HTMLImageElement|null)[], loaded: number, ready: boolean},
 *          mode: string}} props   images: from usePreloadedImages(frames' urls)
 */
export default function BlinkView({ frames, grid, images, mode }) {
  const playback = usePlayback(frames.length, frames);

  if (!images.ready) {
    return <PlayerPlaceholder>Loading frames: {images.loaded} of {frames.length}…</PlayerPlaceholder>;
  }

  const { index } = playback;
  const frame = frames[index];
  const label = frameLabel(frame, index, frames.length, mode);

  function handleKeyDown(e) {
    const actions = {
      " ": playback.togglePlaying,
      ArrowLeft: () => playback.step(-1),
      ArrowRight: () => playback.step(1),
    };
    const action = actions[e.key];
    if (!action || e.target.closest("button, input")) return; // buttons/sliders handle their own keys
    e.preventDefault();
    action();
  }

  return (
    <div className="fp-view" tabIndex={0} onKeyDown={handleKeyDown} aria-label="Blink view">
      <FrameCanvas image={images.images[index]} width={grid.width} height={grid.height} label={`SPHEREx image, ${label}`}>
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
      <FrameInfo frame={frame} index={index} count={frames.length} mode={mode} />
    </div>
  );
}
