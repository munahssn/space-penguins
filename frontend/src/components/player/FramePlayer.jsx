// The player: loads the frames for the current view and shows them as Blink, Difference or IR colour.
// Reads everything from useViewState(). Optional `heading` (e.g. the target's name) sits on the same row
// as the view switch: <FramePlayer heading={<TargetHeading />} />
//
// Overlays (Gaia stars, known asteroids, flagged pixels) show in Blink; click-to-select works in every view.
import { useState } from "react";
import { useViewState } from "../../hooks/useViewState.jsx";
import BlinkView from "./BlinkView.jsx";
import { DEFAULT_OVERLAYS } from "./constants.js";
import DisplaySwitch from "./DisplaySwitch.jsx";
import OverlayToggles from "./OverlayToggles.jsx";
import { LoadingProgress, PlayerPlaceholder, errorMessage } from "./PlayerStatus.jsx";
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
  return frames.some((f) => f.flags_url) ? {} : { flags: "Not available for this data yet" };
}

/** What to show instead of the player while there are no frames to play, or null when there are. */
function statusInstead(view, { error, loading, progress, frames }) {
  if (view.ra === null || view.dec === null) {
    return <PlayerPlaceholder>Search for an object or pick one of the popular finds to start.</PlayerPlaceholder>;
  }
  if (error) return <PlayerPlaceholder tone="error">{errorMessage(error)}</PlayerPlaceholder>;
  if (loading) return <PlayerPlaceholder><LoadingProgress progress={progress} /></PlayerPlaceholder>;
  if (frames.length === 0) return <PlayerPlaceholder>No SPHEREx images cover this position yet.</PlayerPlaceholder>;
  return null;
}

/** One line of help under the controls. The keys only work in Blink. */
function PlayerTip({ display }) {
  return (
    <p className="fp-tip">
      Tip: click any dot to check if it's already known.
      {display === "blink" && (
        <> On a keyboard, Tab to the image, then <kbd>Space</kbd> plays and <kbd>←</kbd> <kbd>→</kbd> step through.</>
      )}
    </p>
  );
}

export default function FramePlayer({ heading = null }) {
  const view = useViewState();
  const frameResult = useFrames(view);
  const [overlays, setOverlays] = useState(DEFAULT_OVERLAYS);
  const { frames, grid } = frameResult;
  // Preloaded here, not in BlinkView, so switching back to Blink is instant.
  const images = usePreloadedImages(frames.map((f) => f.url));

  const status = statusInstead(view, frameResult);
  if (status) {
    return (
      <section className="fp" aria-label="Frame player">
        {heading && <div className="fp-head rise">{heading}</div>}
        {status}
      </section>
    );
  }

  const unavailable = unavailableDisplays(frames.length);
  const display = unavailable[view.display] ? "blink" : view.display;
  const missingOverlays = unavailableOverlays(frames);
  const activeOverlays = { ...overlays, flags: overlays.flags && !missingOverlays.flags };
  const toggleOverlay = (id, on) => setOverlays((current) => ({ ...current, [id]: on }));

  return (
    <section className="fp" aria-label="Frame player">
      <div className="fp-head rise">
        {heading}
        <DisplaySwitch value={display} onChange={view.setDisplay} disabled={unavailable} />
      </div>
      {display === "blink" && (
        <OverlayToggles value={overlays} onChange={toggleOverlay} unavailable={missingOverlays} />
      )}
      {/* Keyed on the view, so switching Blink / Difference / IR colour fades the new image in. */}
      <div key={display} className="fp-swap">
        {display === "blink"
          ? <BlinkView frames={frames} grid={grid} images={images} view={view} overlays={activeOverlays} />
          : <StillView kind={display} view={view} frames={frames} grid={grid} />}
      </div>
      <PlayerTip display={display} />
    </section>
  );
}
