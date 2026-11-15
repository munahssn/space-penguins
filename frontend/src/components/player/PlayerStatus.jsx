// Loading, empty and error messages shared by every player view. They keep the player's square footprint
// so the layout doesn't jump while things load.

/** One line describing an API request in progress (see onProgress in api.js). */
function progressMessage(progress, what = "SPHEREx images") {
  if (progress?.status === "queued") return `Waiting in line: you're number ${progress.position}`;
  if (progress?.status === "processing") return `Processing ${what} · ${progress.done} of ${progress.total}`;
  if (progress?.status === "retrying") return "The archive is busy, trying again…";
  return `Finding ${what}…`;
}

/** ApiError carries an HTTP status; anything else (e.g. TypeError "Failed to fetch") means no connection. */
export function errorMessage(error, what = "frames") {
  if (error.status) return `Couldn't load ${what}: ${error.message}`;
  return "Can't reach the server. It may be waking up, so try again in a minute.";
}

/**
 * Thin bar under a loading message. With a count it fills to done/total (smoothly, unless motion is
 * reduced); without one it shows that something is happening.
 * @param {{done?: number, total?: number, label: string}} props
 */
export function ProgressBar({ done, total, label }) {
  const counted = Number.isFinite(done) && total > 0;
  return (
    <div
      className={`fp-bar ${counted ? "" : "fp-bar--busy"}`.trim()}
      role="progressbar"
      aria-label={label}
      aria-valuemin={counted ? 0 : undefined}
      aria-valuemax={counted ? total : undefined}
      aria-valuenow={counted ? done : undefined}
    >
      <span className="fp-bar-fill" style={counted ? { width: `${(done / total) * 100}%` } : undefined} />
    </div>
  );
}

/**
 * Message + progress bar for a request to the backend (frames, difference or colour image).
 * `text` replaces the message worked out from `progress`.
 */
export function LoadingProgress({ progress, what, text }) {
  const counted = progress?.status === "processing";
  return (
    <div className="fp-loading">
      <p className="fp-loading-text">{text ?? progressMessage(progress, what)}</p>
      <ProgressBar
        done={counted ? progress.done : undefined}
        total={counted ? progress.total : undefined}
        label={`Loading ${what ?? "SPHEREx images"}`}
      />
    </div>
  );
}

/** @param {{tone?: "muted" | "error", children: React.ReactNode}} props */
export function PlayerPlaceholder({ tone = "muted", children }) {
  return (
    <div className={`fp-placeholder fp-placeholder--${tone}`} role={tone === "error" ? "alert" : "status"}>
      {children}
    </div>
  );
}
