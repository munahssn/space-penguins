import { useViewState } from "../../hooks/useViewState.jsx";
import { DETECTOR_OPTIONS, FOV_OPTIONS, STRETCH_OPTIONS, arcminLabel } from "./options.js";
import SelectField from "./SelectField.jsx";
import WavelengthSlider from "./WavelengthSlider.jsx";
import "./controls.css";

/** View settings under the player. Everything writes to useViewState, so it ends up in the URL. */
export default function ControlPanel() {
  const { fov, det, stretch, setFov, setStretch, setView } = useViewState();

  // A wavelength filter only makes sense inside one detector's range, so a new detector clears it.
  const changeDetector = (value) => setView({ det: value, wmin: null, wmax: null });

  return (
    <section className="control-panel" aria-label="View settings">
      <SelectField label="Field of view" value={fov} options={FOV_OPTIONS} onChange={setFov} formatExtra={arcminLabel} />
      <SelectField label="Detector (wavelength)" value={det} options={DETECTOR_OPTIONS} onChange={changeDetector} />
      <SelectField label="Brightness" value={stretch} options={STRETCH_OPTIONS} onChange={setStretch} />
      <WavelengthSlider />
    </section>
  );
}
