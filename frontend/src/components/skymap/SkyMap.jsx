// Context sky map (#12): Aladin Lite v3 centred on the target, with a square showing the player's field,
// and a switch between the optical sky (DSS) and the infrared sky (WISE) for comparison.
import { useEffect, useRef, useState } from "react";
import { useViewState } from "../../hooks/useViewState.jsx";
import { RAD_PER_DEG, wrapDegrees } from "../../utils/angles.js";
import { useAladin } from "./useAladin.js";
import { useReachable } from "./useReachable.js";
import "./skymap.css";

/**
 * The two sky layers, each with the exact mirror to fetch its tiles from.
 *
 * Naming a `url` matters: left to itself Aladin looks surveys up by id through alasky.unistra.fr,
 * a hostname that no longer resolves, so it would never request a single tile. These are the same
 * CDS sky surveys, served by IRSA, which also hosts the SPHEREx data this app is built on.
 */
const SKY_LAYERS = [
  {
    id: "optical",
    label: "Visible light",
    credit: "DSS2 colour",
    survey: "CDS/P/DSS2/color",
    url: "https://irsa.ipac.caltech.edu/data/hips/CDS/DSS2/color",
    maxOrder: 9,
  },
  {
    id: "infrared",
    label: "Infrared",
    credit: "AllWISE colour",
    survey: "CDS/P/allWISE/color",
    url: "https://irsa.ipac.caltech.edu/data/hips/CDS/AllWISE/RGB-W4-W2-W1",
    maxOrder: 8,
  },
];
/** The tile host, asked only to explain a map that hasn't appeared, so no exact file is needed. */
const SKY_SERVER_URL = "https://irsa.ipac.caltech.edu/data/hips/CDS/DSS2/color/properties";
const MAP_FOV_PER_FIELD = 6; // the map shows ~6× the player's field, so the square has context around it
const MIN_MAP_FOV_DEG = 0.5;
const FIELD_STYLE = { color: "#ffffff", lineWidth: 2 };

const ALADIN_OPTIONS = {
  survey: SKY_LAYERS[0].url, // the layer effect below re-sets this with the full mirror details
  cooFrame: "equatorial",
  showReticle: false,          // the field square marks the target instead
  showLayersControl: false,    // our own Optical / Infrared switch replaces Aladin's layer menu
  showProjectionControl: false,
  showFrame: false,
  showStatusBar: false,
  showContextMenu: false,
  showFullscreenControl: true,
  showZoomControl: true,
  showCooLocation: true,
};

const mapFov = (fieldDeg) => Math.max(MIN_MAP_FOV_DEG, fieldDeg * MAP_FOV_PER_FIELD);

/** Corners of a fov × fov square centred on (ra, dec). RA spacing widens by 1/cos(dec) away from the equator. */
function fieldCorners(ra, dec, fov) {
  const half = fov / 2;
  const halfRa = half / Math.cos(dec * RAD_PER_DEG);
  return [
    [wrapDegrees(ra - halfRa), dec - half],
    [wrapDegrees(ra + halfRa), dec - half],
    [wrapDegrees(ra + halfRa), dec + half],
    [wrapDegrees(ra - halfRa), dec + half],
  ];
}

function LayerSwitch({ value, onChange }) {
  return (
    <div className="skymap-layers" role="group" aria-label="Sky layer">
      {SKY_LAYERS.map((layer) => (
        <button
          key={layer.id}
          type="button"
          className="toggle"
          aria-pressed={layer.id === value.id}
          title={layer.credit}
          onClick={() => onChange(layer)}
        >
          {layer.label}
        </button>
      ))}
    </div>
  );
}

/** What to show while there's no viewer yet. */
function statusMessage(reachable, error) {
  if (error) return "The sky map couldn't load.";
  if (reachable === "unreachable") return "Can't reach the CDS sky servers. Still trying…";
  return "Loading sky map…";
}

export default function SkyMap() {
  const { ra, dec, fov } = useViewState();
  const containerRef = useRef(null);
  const overlayRef = useRef(null);
  // The map always loads; the probe only decides what a map that hasn't appeared yet should say.
  const reachable = useReachable(SKY_SERVER_URL);
  const { A, aladin, error } = useAladin(containerRef, ALADIN_OPTIONS);
  const [layer, setLayer] = useState(SKY_LAYERS[0]);
  const shownLayerRef = useRef(null); // which layer Aladin displays now

  useEffect(() => {
    if (!aladin || shownLayerRef.current === layer.id) return;
    aladin.setBaseImageLayer(A.HiPS(layer.survey, { url: layer.url, maxOrder: layer.maxOrder }));
    shownLayerRef.current = layer.id;
  }, [A, aladin, layer]);

  useEffect(() => {
    if (!aladin || ra === null || dec === null) return;
    if (!overlayRef.current) {
      overlayRef.current = A.graphicOverlay(FIELD_STYLE);
      aladin.addOverlay(overlayRef.current);
    }
    aladin.gotoRaDec(ra, dec);
    aladin.setFoV(mapFov(fov));
    overlayRef.current.removeAll();
    overlayRef.current.add(A.polygon(fieldCorners(ra, dec, fov)));
  }, [A, aladin, ra, dec, fov]);

  return (
    <section className="skymap rise rise-1" aria-labelledby="skymap-title">
      <div className="skymap-head">
        <h2 id="skymap-title" className="panel-title">Sky Map</h2>
        {aladin && <LayerSwitch value={layer} onChange={setLayer} />}
      </div>
      <div className="skymap-frame">
        <div ref={containerRef} className="skymap-view" />
        {!aladin && <div className="skymap-overlay-message">{statusMessage(reachable, error)}</div>}
      </div>
      <p className="skymap-caption">
        <span className="skymap-key" aria-hidden="true" /> Field shown in the player · Sky: {layer.credit} (CDS via IRSA), shown with Aladin Lite
      </p>
    </section>
  );
}
