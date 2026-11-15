// Charts (#11): Spectrum / Motion / Brightness over time tabs for the clicked spot, or for the target
// itself until something is clicked. Only the visible tab's data is fetched.
import { useId, useState } from "react";
import { getLightcurve, getSpectrum, getTrack } from "../../api/api.js";
import { useRequest } from "../../hooks/useRequest.js";
import { useViewState } from "../../hooks/useViewState.jsx";
import { ChartMessage } from "./ChartParts.jsx";
import LightCurveChart from "./LightCurveChart.jsx";
import MotionTrackChart from "./MotionTrackChart.jsx";
import SpectrumChart from "./SpectrumChart.jsx";
import "./charts.css";

/**
 * One entry per tab: its label, what to call it in messages, how to fetch its data, whether there's
 * anything to draw, and how to draw it.
 */
const TABS = [
  {
    id: "spectrum",
    label: "Spectrum",
    name: "spectrum",
    request: ({ ra, dec }, signal) => getSpectrum({ ra, dec }, { signal }),
    hasData: (data) => data.points?.length > 0,
    render: (data) => <SpectrumChart spectrum={data} />,
  },
  {
    id: "track",
    label: "Motion",
    name: "motion track",
    request: ({ ra, dec }, signal) => getTrack({ ra, dec }, { signal }),
    hasData: (data) => data.measured?.length > 0,
    render: (data) => <MotionTrackChart track={data} />,
  },
  {
    id: "lightcurve",
    label: "Brightness over time",
    name: "light curve",
    request: ({ ra, dec, det }, signal) => getLightcurve({ ra, dec, det }, { signal }),
    hasData: (data) => data.points?.length > 0,
    render: (data, { det }) => <LightCurveChart lightcurve={data} det={det} />,
  },
];

/** The spot the charts describe: the clicked one, else the centre of the view. */
function chartPosition({ selected, ra, dec }) {
  if (selected) return { ra: selected.ra, dec: selected.dec, isSelection: true };
  if (ra === null || dec === null) return null;
  return { ra, dec, isSelection: false };
}

function TabContent({ tab, position, det }) {
  const key = `${tab.id}|${position.ra}|${position.dec}|${det}`;
  const { data, error, loading } = useRequest(key, (signal) => tab.request({ ...position, det }, signal));

  if (error) return <ChartMessage tone="error">Couldn't load the {tab.name}: {error.message}</ChartMessage>;
  if (loading || !data) {
    return <ChartMessage loading>Loading the {tab.name}… The first time can take a minute.</ChartMessage>;
  }
  if (!tab.hasData(data)) return <ChartMessage>No {tab.name} data for this spot.</ChartMessage>;
  return tab.render(data, { det });
}

export default function ChartsPanel() {
  const view = useViewState();
  const [activeId, setActiveId] = useState(TABS[0].id);
  const idPrefix = useId();
  const position = chartPosition(view);
  const active = TABS.find((t) => t.id === activeId);

  return (
    <section className="charts rise" aria-labelledby={`${idPrefix}-title`}>
      <div className="charts-head">
        <h2 id={`${idPrefix}-title`} className="panel-title">Charts</h2>
        {position && (
          <span className="charts-subject">
            {position.isSelection ? "For the spot you clicked" : "For the target · click a dot to change"}
          </span>
        )}
      </div>

      <div role="tablist" aria-label="Chart type" className="charts-tabs">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            id={`${idPrefix}-tab-${tab.id}`}
            type="button"
            role="tab"
            aria-selected={tab.id === activeId}
            aria-controls={`${idPrefix}-panel`}
            onClick={() => setActiveId(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div id={`${idPrefix}-panel`} role="tabpanel" aria-labelledby={`${idPrefix}-tab-${activeId}`}>
        {position
          ? <TabContent key={active.id} tab={active} position={position} det={view.det} />
          : <ChartMessage>Pick a target to see its charts.</ChartMessage>}
      </div>
    </section>
  );
}
