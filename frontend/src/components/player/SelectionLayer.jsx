// Click anywhere on the image to select that spot: turns the click into RA/Dec and shows an orange
// dashed ring there. The selection feeds the "Is it new?" panel (#10) through useViewState.
//
// Pointer only: keyboard users can type exact coordinates in the search bar instead.
import { MARKER_SIZES } from "./constants.js";
import { isOnImage, pixelToPercent, pixelToSky, skyToPixel } from "./skyProjection.js";

const DECIMALS = 6; // ~0.004″, far finer than a 6″ pixel
const round = (value) => Number(value.toFixed(DECIMALS));

/** Click position → image pixel coordinates, using the layer's on-screen size. */
function clickToPixel(event, grid) {
  const box = event.currentTarget.getBoundingClientRect();
  return {
    x: ((event.clientX - box.left) / box.width) * grid.width,
    y: ((event.clientY - box.top) / box.height) * grid.height,
  };
}

/**
 * @param {{grid: object, center: {ra:number, dec:number}, selected: {ra:number, dec:number}|null,
 *          onSelect: (position: {ra:number, dec:number}) => void}} props
 */
export default function SelectionLayer({ grid, center, selected, onSelect }) {
  function handleClick(event) {
    const sky = pixelToSky(clickToPixel(event, grid), center, grid);
    onSelect({ ra: round(sky.ra), dec: round(sky.dec) });
  }

  const ringPixel = selected ? skyToPixel(selected, center, grid) : null;
  const ringSize = `${((2 * MARKER_SIZES.selectedRing) / grid.width) * 100}%`;

  return (
    <div className="fp-layer fp-select-layer" onClick={handleClick} title="Click a spot to check it">
      {isOnImage(ringPixel, grid) && (
        <span
          className="fp-selected-ring"
          style={{ ...pixelToPercent(ringPixel, grid), width: ringSize }}
          aria-hidden="true"
        />
      )}
    </div>
  );
}
