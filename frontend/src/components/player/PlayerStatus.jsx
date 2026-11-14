// Loading, empty and error messages shared by every player view. They keep the player's square footprint
// so the layout doesn't jump while things load.

/** One line describing an API request in progress (see onProgress in api.js). */
export function progressMessage(progress, what = "SPHEREx images") {
  if (progress?.status === "queued") return `Waiting in line (position ${progress.position})…`;
  if (progress?.status === "processing") return `Processing ${what}: ${progress.done} of ${progress.total}…`;
  if (progress?.status === "retrying") return "The archive is busy, trying again…";
  return `Finding ${what}…`;
}

/** ApiError carries an HTTP status; anything else (e.g. TypeError "Failed to fetch") means no connection. */
export function errorMessage(error, what = "frames") {
  if (error.status) return `Couldn't load ${what}: ${error.message}`;
  return "Can't reach the server. It may be waking up, so try again in a minute.";
}

/** @param {{tone?: "muted" | "error", children: React.ReactNode}} props */
export function PlayerPlaceholder({ tone = "muted", children }) {
  return (
    <div className={`fp-placeholder fp-placeholder--${tone}`} role={tone === "error" ? "alert" : "status"}>
      {children}
    </div>
  );
}
