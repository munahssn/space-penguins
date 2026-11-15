import { useViewState } from "../../hooks/useViewState.jsx";
import ChoiceButtons from "./ChoiceButtons.jsx";
import { DETECTOR_OPTIONS, FOV_OPTIONS, STRETCH_OPTIONS, arcminLabel } from "./options.js";
import SelectField from "./SelectField.jsx";
import WavelengthSlider from "./WavelengthSlider.jsx";
import "./controls.css";

/** View settings in the side panel. Everything writes to useViewState, so it ends up in the URL. */
export default function ControlPanel() {
  const { fov, det, stretch, setFov, setStretch, setView } = useViewState();

  // A wavelength filter only makes sense inside one detector's range, so a new detector clears it.
  const changeDetector = (value) => setView({ det: value, wmin: null, wmax: null });

  return (
    <section className="side-block control-panel rise rise-1" aria-labelledby="control-panel-title">
      <h2 id="control-panel-title" className="panel-title">View Settings</h2>
      <ChoiceButtons
        label="Zoom"
        hint="how much sky to show"
        value={fov}
        options={FOV_OPTIONS}
        onChange={setFov}
        formatExtra={arcminLabel}
      />
      <SelectField label="Wavelength band" hint="which detector" value={det} options={DETECTOR_OPTIONS} onChange={changeDetector} />
      <WavelengthSlider />
      <ChoiceButtons label="Brightness" hint="Blink view only" value={stretch} options={STRETCH_OPTIONS} onChange={setStretch} />
    </section>
  );
}
