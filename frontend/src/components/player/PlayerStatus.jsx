// Loading, empty and error messages shared by every player view. They keep the player's square footprint
// so the layout doesn't jump while things load.

const DEFAULT_WHAT = "SPHEREx images";

/** One line describing an API request in progress (see onProgress in api.js). */
function progressMessage(progress, what) {
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
function ProgressBar({ done, total, label }) {
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

/** A loading line with a progress bar under it. Without done/total the bar just shows activity. */
export function LoadingMessage({ text, done, total, label }) {
  return (
    <div className="fp-loading">
      <p className="fp-loading-text">{text}</p>
      <ProgressBar done={done} total={total} label={label} />
    </div>
  );
}

/**
 * Loading line for a request to the backend (frames, difference or colour image), worked out from its
 * latest progress update. `text` replaces the worked-out line.
 */
export function LoadingProgress({ progress, what = DEFAULT_WHAT, text }) {
  const counted = progress?.status === "processing";
  return (
    <LoadingMessage
      text={text ?? progressMessage(progress, what)}
      done={counted ? progress.done : undefined}
      total={counted ? progress.total : undefined}
      label={`Loading ${what}`}
    />
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
