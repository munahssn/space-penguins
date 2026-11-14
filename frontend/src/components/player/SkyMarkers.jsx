// Gaia stars (blue circles) and known asteroids (purple dot + name) drawn over the image.
// Shapes are SVG in image-pixel units (so they line up with the canvas); names are HTML so the
// text stays readable at any player size.
import { MARKER_SIZES } from "./constants.js";
import { isOnImage, pixelToPercent, skyToPixel } from "./skyProjection.js";

/** Puts each item on the image, dropping those outside it. */
function placeOnImage(items, center, grid) {
  return items
    .map((item) => ({ item, pixel: skyToPixel(item, center, grid) }))
    .filter(({ pixel }) => isOnImage(pixel, grid));
}

/**
 * @param {{grid: object, center: {ra:number, dec:number}, stars: object[], asteroids: object[],
 *          showStars: boolean, showAsteroids: boolean}} props
 */
export default function SkyMarkers({ grid, center, stars, asteroids, showStars, showAsteroids }) {
  const placedStars = showStars ? placeOnImage(stars, center, grid) : [];
  const placedAsteroids = showAsteroids ? placeOnImage(asteroids, center, grid) : [];

  return (
    <div className="fp-layer" aria-hidden="true">
      <svg className="fp-layer" viewBox={`0 0 ${grid.width} ${grid.height}`} preserveAspectRatio="none">
        {placedStars.map(({ item, pixel }) => (
          <circle
            key={item.source_id}
            className="fp-marker-star"
            cx={pixel.x}
            cy={pixel.y}
            r={MARKER_SIZES.starRing}
          />
        ))}
        {placedAsteroids.map(({ item, pixel }) => (
          <circle
            key={item.name}
            className="fp-marker-asteroid"
            cx={pixel.x}
            cy={pixel.y}
            r={MARKER_SIZES.asteroidDot}
          />
        ))}
      </svg>
      {placedAsteroids.map(({ item, pixel }) => (
        <span key={item.name} className="fp-marker-label" style={pixelToPercent(pixel, grid)}>
          {item.name}
        </span>
      ))}
    </div>
  );
}
