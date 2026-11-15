import { useCopyToClipboard } from "../../hooks/useCopyToClipboard.js";
import { useViewState } from "../../hooks/useViewState.jsx";
import { embedSnippet } from "./embedSnippet.js";

/** Copies getText() and says so. If the clipboard is blocked (plain http, some browsers) shows it to copy by hand. */
function CopyButton({ label, copiedLabel, promptLabel, getText, className, title }) {
  const [copied, copy] = useCopyToClipboard();

  async function handleClick() {
    const text = getText();
    if (!(await copy(text))) window.prompt(promptLabel, text);
  }

  return (
    <button type="button" className={className} onClick={handleClick} title={title} aria-live="polite">
      {copied ? copiedLabel : label}
    </button>
  );
}

/**
 * "Copy link" and "Embed" in the header. Both reopen the current view (buildShareUrl in useViewState);
 * Embed wraps the ?embed=1 version in an <iframe> snippet.
 */
export default function ShareActions() {
  const { shareUrl } = useViewState();

  return (
    <>
      <CopyButton
        className="btn-ghost"
        label="Copy link"
        copiedLabel="Copied!"
        promptLabel="Copy this link:"
        getText={() => shareUrl()}
      />
      <CopyButton
        className="btn-ghost"
        label="Embed"
        copiedLabel="Snippet copied!"
        promptLabel="Copy this embed code:"
        getText={() => embedSnippet(shareUrl({ embed: true }))}
        title="Copy an <iframe> snippet that shows this view on another page"
      />
    </>
  );
}
