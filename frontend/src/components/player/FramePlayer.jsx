// The player: loads the frames for the current view and shows them as Blink, Difference or IR colour.
// Reads everything from useViewState(), so it needs no props: <FramePlayer />
//
// Overlays (Gaia stars, known asteroids, flagged pixels) show in Blink; click-to-select works in every view.
import { useState } from "react";
import { useViewState } from "../../hooks/useViewState.jsx";
import BlinkView from "./BlinkView.jsx";
import { DEFAULT_OVERLAYS } from "./constants.js";
import DisplaySwitch from "./DisplaySwitch.jsx";
import OverlayToggles from "./OverlayToggles.jsx";
import { PlayerPlaceholder, errorMessage, progressMessage } from "./PlayerStatus.jsx";
import StillView from "./StillView.jsx";
import { useFrames } from "./useFrames.js";
import { usePreloadedImages } from "./usePreloadedImages.js";
import "./FramePlayer.css";

/** Views that can't be shown for this frame list, with the reason (shown as a tooltip). */
function unavailableDisplays(frameCount) {
  return frameCount < 2 ? { diff: "Needs at least two survey passes" } : {};
}

/** Overlays the data can't support, with the reason. */
function unavailableOverlays(frames) {
  return frames.some((f) => f.flags_url) ? {} : { flags: "No flag masks for this data yet" };
}

export default function FramePlayer() {
  const view = useViewState();
  const frameResult = useFrames(view);
  const [overlays, setOverlays] = useState(DEFAULT_OVERLAYS);
  const { frames, grid } = frameResult;
  // Preloaded here, not in BlinkView, so switching back to Blink is instant.
  const images = usePreloadedImages(frames.map((f) => f.url));

  if (view.ra === null || view.dec === null) {
    return <PlayerPlaceholder>Search for an object or pick a test target to start.</PlayerPlaceholder>;
  }
  if (frameResult.error) {
    return <PlayerPlaceholder tone="error">{errorMessage(frameResult.error)}</PlayerPlaceholder>;
  }
  if (frameResult.loading) {
    return <PlayerPlaceholder>{progressMessage(frameResult.progress)}</PlayerPlaceholder>;
  }
  if (frames.length === 0) {
    return <PlayerPlaceholder>No SPHEREx images cover this position yet.</PlayerPlaceholder>;
  }

  const unavailable = unavailableDisplays(frames.length);
  const display = unavailable[view.display] ? "blink" : view.display;
  const missingOverlays = unavailableOverlays(frames);
  const activeOverlays = { ...overlays, flags: overlays.flags && !missingOverlays.flags };
  const toggleOverlay = (id, on) => setOverlays((current) => ({ ...current, [id]: on }));

  return (
    <section className="fp" aria-label="Frame player">
      <div className="fp-toolbar">
        <DisplaySwitch value={display} onChange={view.setDisplay} disabled={unavailable} />
        {display === "blink" && (
          <OverlayToggles value={overlays} onChange={toggleOverlay} unavailable={missingOverlays} />
        )}
      </div>
      {display === "blink"
        ? <BlinkView frames={frames} grid={grid} images={images} view={view} overlays={activeOverlays} />
        : <StillView kind={display} view={view} frames={frames} grid={grid} />}
    </section>
  );
}
