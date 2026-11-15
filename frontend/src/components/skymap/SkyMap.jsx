// Context sky map (#12): Aladin Lite v3 centred on the target, with a square showing the player's field,
// and a switch between the optical sky (DSS) and the infrared sky (WISE) for comparison.
import { useEffect, useRef, useState } from "react";
import { useViewState } from "../../hooks/useViewState.jsx";
import { RAD_PER_DEG, wrapDegrees } from "../../utils/angles.js";
import { useAladin } from "./useAladin.js";
import { useReachable } from "./useReachable.js";
import "./skymap.css";

const SKY_LAYERS = [
  { id: "optical", label: "Visible light", survey: "P/DSS2/color", credit: "DSS2 colour" },
  { id: "infrared", label: "Infrared", survey: "P/allWISE/color", credit: "AllWISE colour" },
];
/** Small file on the CDS server that serves both layers: if it answers, the sky tiles will load too. */
const SURVEY_CHECK_URL = "https://alasky.cds.unistra.fr/DSS/DSSColor/properties";
const MAP_FOV_PER_FIELD = 6; // the map shows ~6× the player's field, so the square has context around it
const MIN_MAP_FOV_DEG = 0.5;
const FIELD_STYLE = { color: "#ffffff", lineWidth: 2 };

const ALADIN_OPTIONS = {
  survey: SKY_LAYERS[0].survey,
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
  if (reachable === "unreachable") return "Sky map unavailable: can't reach the CDS sky servers.";
  if (error) return "The sky map couldn't load.";
  return "Loading sky map…";
}

export default function SkyMap() {
  const { ra, dec, fov } = useViewState();
  const containerRef = useRef(null);
  const overlayRef = useRef(null);
  const reachable = useReachable(SURVEY_CHECK_URL);
  const { A, aladin, error } = useAladin(containerRef, ALADIN_OPTIONS, reachable === "ok");
  const [layer, setLayer] = useState(SKY_LAYERS[0]);
  const shownSurveyRef = useRef(ALADIN_OPTIONS.survey); // what Aladin displays now

  useEffect(() => {
    if (!aladin || shownSurveyRef.current === layer.survey) return;
    aladin.setBaseImageLayer(layer.survey);
    shownSurveyRef.current = layer.survey;
  }, [aladin, layer]);

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
        <span className="skymap-key" aria-hidden="true" /> Field shown in the player · Sky: {layer.credit} via Aladin Lite (CDS)
      </p>
    </section>
  );
}
