// Blink: plays the frames one after another so moving things jump out, with overlays on top.
// Keyboard (when focused): Space = play/pause, ←/→ = previous/next frame.
import FlagTint from "./FlagTint.jsx";
import FrameCanvas from "./FrameCanvas.jsx";
import FrameInfo, { frameLabel } from "./FrameInfo.jsx";
import PlayerControls from "./PlayerControls.jsx";
import { PlayerPlaceholder, ProgressBar } from "./PlayerStatus.jsx";
import ScaleBar from "./ScaleBar.jsx";
import SelectionLayer from "./SelectionLayer.jsx";
import SkyMarkers from "./SkyMarkers.jsx";
import { useFrameContext } from "./useFrameContext.js";
import { usePlayback } from "./usePlayback.js";
import { usePreloadedImages } from "./usePreloadedImages.js";

/** Overlay lists from /api/context; missing fields (or no answer yet) just mean nothing to draw. */
function overlayItems(context) {
  return {
    stars: Array.isArray(context?.stars) ? context.stars : [],
    asteroids: Array.isArray(context?.asteroids) ? context.asteroids : [],
  };
}

/**
 * @param {{frames: object[], grid: object, images: object, view: object, overlays: Record<string, boolean>}} props
 *   images: usePreloadedImages(frames' urls) · view: useViewState() · overlays: which overlays are on
 */
export default function BlinkView({ frames, grid, images, view, overlays }) {
  const playback = usePlayback(frames.length, frames);
  const frame = frames[playback.index];
  const context = overlayItems(useFrameContext(view, frame.mjd, overlays.stars || overlays.asteroids));
  const maskUrls = overlays.flags ? frames.map((f) => f.flags_url).filter(Boolean) : [];
  const masks = usePreloadedImages(maskUrls);

  if (!images.ready) {
    return (
      <PlayerPlaceholder>
        <div className="fp-loading">
          <p className="fp-loading-text">Loading images · {images.loaded} of {frames.length}</p>
          <ProgressBar done={images.loaded} total={frames.length} label="Loading images" />
        </div>
      </PlayerPlaceholder>
    );
  }

  const center = { ra: view.ra, dec: view.dec };
  // The verdict is "at a frame's date", so a click remembers which frame it was made on.
  const selectHere = (position) => view.setSelected({ ...position, mjd: frame.mjd, date: frame.date });
  const label = frameLabel(frame, playback.index, frames.length, view.mode);
  const mask = masks.images[maskUrls.indexOf(frame.flags_url)] ?? null;

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
      <FrameCanvas
        image={images.images[playback.index]}
        width={grid.width}
        height={grid.height}
        label={`SPHEREx image, ${label}`}
        stretch={view.stretch}
      >
        {overlays.flags && <FlagTint mask={mask} width={grid.width} height={grid.height} />}
        <SkyMarkers
          grid={grid}
          center={center}
          stars={context.stars}
          asteroids={context.asteroids}
          showStars={overlays.stars}
          showAsteroids={overlays.asteroids}
        />
        <SelectionLayer grid={grid} center={center} selected={view.selected} onSelect={selectHere} />
        <span className="fp-badge">{label}</span>
        <ScaleBar grid={grid} />
      </FrameCanvas>
      <PlayerControls
        frames={frames}
        index={playback.index}
        playing={playback.playing}
        speed={playback.speed}
        onTogglePlay={playback.togglePlaying}
        onPick={playback.goTo}
        onSpeed={playback.setSpeed}
      />
      <FrameInfo frame={frame} index={playback.index} count={frames.length} mode={view.mode} />
    </div>
  );
}
