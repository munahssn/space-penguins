import { useCopyToClipboard } from "../../hooks/useCopyToClipboard.js";

/**
 * "Copy link" and "Embed" buttons in the header.
 * The URL already holds the view (useViewState), so copying location.href shares it.
 * Embed opens the iframe snippet in #14; until then the button is disabled.
 */
export default function ShareActions({ onEmbed }) {
  const [copied, copy] = useCopyToClipboard();

  return (
    <>
      <button type="button" className="btn-ghost" onClick={() => copy(window.location.href)}>
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
