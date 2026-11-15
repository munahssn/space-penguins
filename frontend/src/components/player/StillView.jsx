// Difference and IR colour: one image computed by the backend, shown with a legend.
import FrameCanvas from "./FrameCanvas.jsx";
import { DiffLegend, RgbLegend } from "./Legend.jsx";
import { LoadingProgress, PlayerPlaceholder, errorMessage } from "./PlayerStatus.jsx";
import ScaleBar from "./ScaleBar.jsx";
import SelectionLayer from "./SelectionLayer.jsx";
import { usePreloadedImages } from "./usePreloadedImages.js";
import { useStillImage } from "./useStillImage.js";

const TEXT = {
  diff: { what: "the difference image", badge: "Difference" },
  rgb: { what: "the colour image", badge: "IR colour (D1 · D3 · D6)" },
};

/**
 * @param {{kind: "diff"|"rgb", view: object, frames: object[], grid: object}} props
 *   frames: the blink frames, used for the dates in the difference legend
 */
export default function StillView({ kind, view, frames, grid }) {
  const still = useStillImage(kind, view);
  const image = usePreloadedImages(still.url ? [still.url] : []);
  const { what, badge } = TEXT[kind];
  // Both still images show the sky as of the latest pass, so a click is dated to that pass.
  const latest = frames.at(-1);
  const selectHere = (position) => view.setSelected({ ...position, mjd: latest.mjd, date: latest.date });

  if (still.error) return <PlayerPlaceholder tone="error">{errorMessage(still.error, what)}</PlayerPlaceholder>;
  if (still.loading) return <PlayerPlaceholder><LoadingProgress progress={still.progress} what={what} /></PlayerPlaceholder>;
  if (!image.ready) return <PlayerPlaceholder><LoadingProgress what={what} text={`Loading ${what}…`} /></PlayerPlaceholder>;

  return (
    <div className="fp-view">
      <FrameCanvas image={image.images[0]} width={grid.width} height={grid.height} label={`SPHEREx ${badge}`}>
        <SelectionLayer
          grid={grid}
          center={{ ra: view.ra, dec: view.dec }}
          selected={view.selected}
          onSelect={selectHere}
        />
        <span className="fp-badge">{badge}</span>
        <ScaleBar grid={grid} />
      </FrameCanvas>
      {kind === "diff"
        ? <DiffLegend firstDate={frames[0].date} lastDate={latest.date} />
        : <RgbLegend />}
    </div>
  );
}
