// Play/pause, frame picker (buttons for a few frames, a slider for many) and speed.
import { MAX_FRAME_BUTTONS, SPEED_LABELS, SPEEDS } from "./constants.js";

function PlayIcon({ playing }) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
      {playing ? (
        <>
          <rect x="3" y="2" width="3.5" height="12" rx="1" fill="currentColor" />
          <rect x="9.5" y="2" width="3.5" height="12" rx="1" fill="currentColor" />
        </>
      ) : (
        <path d="M4 2.5v11l9.5-5.5z" fill="currentColor" />
      )}
    </svg>
  );
}

function FrameButtons({ frames, index, onPick }) {
  return (
    <div className="fp-frames" role="group" aria-label="Frames">
      {frames.map((frame, i) => (
        <button
          key={frame.id}
          type="button"
          className="fp-frame-btn"
          aria-pressed={i === index}
          onClick={() => onPick(i)}
        >
          <span className="fp-frame-btn-num">{i + 1}</span>
          <span className="fp-frame-btn-date">{frame.date}</span>
        </button>
      ))}
    </div>
  );
}

function FrameSlider({ count, index, onPick }) {
  return (
    <label className="fp-slider">
      <span className="fp-visually-hidden">Frame</span>
      <input
        type="range"
        min={0}
        max={count - 1}
        value={index}
        onChange={(e) => onPick(Number(e.target.value))}
      />
    </label>
  );
}

function SpeedPicker({ speed, onChange }) {
  return (
    <div className="fp-speed" role="group" aria-label="Speed">
      {Object.keys(SPEEDS).map((key) => (
        <button
          key={key}
          type="button"
          aria-pressed={key === speed}
          onClick={() => onChange(key)}
        >
          {SPEED_LABELS[key]}
        </button>
      ))}
    </div>
  );
}

/**
 * @param {{frames: object[], index: number, playing: boolean, speed: string,
 *          onTogglePlay: () => void, onPick: (i: number) => void, onSpeed: (s: string) => void}} props
 */
export default function PlayerControls({ frames, index, playing, speed, onTogglePlay, onPick, onSpeed }) {
  const canPlay = frames.length > 1;

  return (
    <div className="fp-controls">
      <button
        type="button"
        className="fp-play"
        onClick={onTogglePlay}
        disabled={!canPlay}
        aria-label={playing ? "Pause" : "Play"}
      >
        <PlayIcon playing={playing && canPlay} />
      </button>
      {frames.length <= MAX_FRAME_BUTTONS
        ? <FrameButtons frames={frames} index={index} onPick={onPick} />
        : <FrameSlider count={frames.length} index={index} onPick={onPick} />}
      <SpeedPicker speed={speed} onChange={onSpeed} />
    </div>
  );
}
