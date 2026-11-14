// Difference and IR colour: one image computed by the backend, shown with a legend.
import FrameCanvas from "./FrameCanvas.jsx";
import { DiffLegend, RgbLegend } from "./Legend.jsx";
import { PlayerPlaceholder, errorMessage, progressMessage } from "./PlayerStatus.jsx";
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

  if (still.error) return <PlayerPlaceholder tone="error">{errorMessage(still.error, what)}</PlayerPlaceholder>;
  if (still.loading) return <PlayerPlaceholder>{progressMessage(still.progress, what)}</PlayerPlaceholder>;
  if (!image.ready) return <PlayerPlaceholder>Loading {what}…</PlayerPlaceholder>;

  return (
    <div className="fp-view">
      <FrameCanvas image={image.images[0]} width={grid.width} height={grid.height} label={`SPHEREx ${badge}`}>
        <SelectionLayer
          grid={grid}
          center={{ ra: view.ra, dec: view.dec }}
          selected={view.selected}
          onSelect={view.setSelected}
        />
        <span className="fp-badge">{badge}</span>
        <ScaleBar grid={grid} />
      </FrameCanvas>
      {kind === "diff"
        ? <DiffLegend firstDate={frames[0].date} lastDate={frames[frames.length - 1].date} />
        : <RgbLegend />}
    </div>
  );
}
