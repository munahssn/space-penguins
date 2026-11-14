import { useViewState } from "../../hooks/useViewState.jsx";
import "./controls.css";

/**
 * Applies the brightness stretch (useViewState `stretch`) to the player's canvas with a CSS filter.
 * The backend's PNGs are already scaled to 8 bit, so this is a display-only boost.
 * Targets the player's `.fp-canvas` class (see controls.css), so FramePlayer needs no changes.
 */
export default function StretchFrame({ children }) {
  const { stretch } = useViewState();
  return (
    <div className="stretch-frame" data-stretch={stretch}>
      {children}
    </div>
  );
}
