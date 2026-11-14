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

/**
 * Turns one progress update from api.js into { tone, text }, or null for nothing to show.
 * Queue position and processing progress are shown where people are looking (the player),
 * so the bar only speaks up when something is wrong: retries after 429 / 503.
 */
function activityMessage(update) {
  if (update?.status !== "retrying") return null;
  const reason = RETRY_REASONS[update.httpStatus] ?? "The server didn't answer.";
  return { tone: "warning", text: `${reason} Trying again in ${Math.round(update.retryInMs / 1000)} s…` };
}

/** Full-width strip under the header for server problems (waking up, unreachable, retrying). Hidden otherwise. */
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
        </div>
      )}
    </div>
  );
}
