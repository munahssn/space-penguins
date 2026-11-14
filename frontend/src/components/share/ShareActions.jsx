import { useCopyToClipboard } from "../../hooks/useCopyToClipboard.js";
import { useViewState } from "../../hooks/useViewState.jsx";

/**
 * "Copy link" and "Embed" buttons in the header.
 * Copy link copies a URL that reopens the current view (see buildShareUrl in useViewState).
 * Embed opens the iframe snippet in #14; until then the button is disabled.
 */
export default function ShareActions({ onEmbed }) {
  const { shareUrl } = useViewState();
  const [copied, copy] = useCopyToClipboard();

  async function copyLink() {
    const url = shareUrl();
    const ok = await copy(url);
    // Clipboard is blocked on plain http and in some browsers: let the user copy it by hand.
    if (!ok) window.prompt("Copy this link:", url);
  }

  return (
    <>
      <button type="button" className="btn-ghost" onClick={copyLink} aria-live="polite">
        {copied ? "Copied!" : "Copy link"}
      </button>
      <button
        type="button"
        className="btn-primary"
        onClick={onEmbed}
        disabled={!onEmbed}
        title={onEmbed ? "Get an embed snippet" : "Embed comes in #14"}
      >
        Embed
      </button>
    </>
  );
}
