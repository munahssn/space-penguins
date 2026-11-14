import { useViewState } from "../../hooks/useViewState.jsx";
import { DETECTOR_OPTIONS, FOV_OPTIONS, STRETCH_OPTIONS, arcminLabel } from "./options.js";
import SelectField from "./SelectField.jsx";
import "./controls.css";

/** View settings under the player. Everything writes to useViewState, so it ends up in the URL. */
export default function ControlPanel() {
  const { fov, det, stretch, setFov, setDet, setStretch } = useViewState();

  return (
    <section className="control-panel" aria-label="View settings">
      <SelectField label="Field of view" value={fov} options={FOV_OPTIONS} onChange={setFov} formatExtra={arcminLabel} />
      <SelectField label="Detector (wavelength)" value={det} options={DETECTOR_OPTIONS} onChange={setDet} />
      <SelectField label="Brightness" value={stretch} options={STRETCH_OPTIONS} onChange={setStretch} />
    </section>
  );
}
