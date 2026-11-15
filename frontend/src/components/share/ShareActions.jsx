import { useCopyToClipboard } from "../../hooks/useCopyToClipboard.js";
import { useViewState } from "../../hooks/useViewState.jsx";
import "./share.css";

/** The usual "share" symbol: three dots joined by lines. */
function ShareIcon() {
  return (
    <svg className="share-icon" viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="18" cy="5" r="2.5" />
      <circle cx="6" cy="12" r="2.5" />
      <circle cx="18" cy="19" r="2.5" />
      <path d="M8.2 10.8 15.8 6.2M8.2 13.2l7.6 4.6" />
    </svg>
  );
}

/**
 * Share button in the header: copies a link that reopens the current view (buildShareUrl in useViewState)
 * and says "Link copied" under it for a moment. If the clipboard is blocked (plain http, some browsers),
 * it shows the link to copy by hand.
 */
export default function ShareActions() {
  const { shareUrl } = useViewState();
  const [copied, copy] = useCopyToClipboard();

  async function handleClick() {
    const link = shareUrl();
    if (!(await copy(link))) window.prompt("Copy this link:", link);
  }

  return (
    <span className="share">
      <button type="button" className="btn-ghost share-btn" onClick={handleClick} aria-label="Share: copy a link to this view" title="Share: copy a link to this view">
        <ShareIcon />
      </button>
      <span className="share-copied" role="status">{copied ? "Link copied" : ""}</span>
    </span>
  );
}
