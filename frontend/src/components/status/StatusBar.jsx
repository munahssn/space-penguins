import { useApiActivity } from "../../hooks/useApiActivity.js";
import { useServerStatus } from "../../hooks/useServerStatus.jsx";
import "./status.css";

const SERVER_MESSAGES = {
  waking: { tone: "info", text: "Waking up the server… this can take about a minute." },
  unreachable: { tone: "error", text: "Can't reach the server right now. Still trying…" },
};

const RETRY_REASONS = {
  429: "Lots of requests right now.",
  503: "The SPHEREx archive is busy.",
};

/** Turns one progress update from api.js into { tone, text, progress? }, or null for nothing to show. */
function activityMessage(update) {
  switch (update?.status) {
    case "queued":
      return { tone: "info", text: `Waiting in line: position ${update.position}` };
    case "processing":
      return {
        tone: "info",
        text: `Processing SPHEREx images: ${update.done} of ${update.total}`,
        progress: { value: update.done, max: update.total },
      };
    case "retrying": {
      const reason = RETRY_REASONS[update.httpStatus] ?? "The server didn't answer.";
      return { tone: "warning", text: `${reason} Trying again in ${Math.round(update.retryInMs / 1000)} s…` };
    }
    default:
      return null;
  }
}

/** Full-width strip under the header. Server problems win over request progress. Hidden when idle. */
export default function StatusBar() {
  const { state } = useServerStatus();
  const activity = useApiActivity();
  const message = SERVER_MESSAGES[state] ?? activityMessage(activity);

  return (
    <div className="status-bar-slot" role="status" aria-live="polite">
      {message && (
        <div className={`status-bar status-bar--${message.tone}`}>
          <span className="status-bar-dot" aria-hidden="true" />
          <span>{message.text}</span>
          {message.progress?.max > 0 && (
            <progress className="status-bar-progress" value={message.progress.value} max={message.progress.max} />
          )}
        </div>
      )}
    </div>
  );
}
