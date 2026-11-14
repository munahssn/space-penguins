// "Is it new?" (#10): for the spot the user clicked on the image, shows whether it's a known star,
// a known asteroid, another known object, or unexplained, with plain-language text, catalog vs.
// measured motion and links to other tools.
//
// Reads the clicked spot from useViewState().selected ({ra, dec, mjd, date}, set by the player).
import { getContext, getExplain, getTrack } from "../../api/api.js";
import { useViewState } from "../../hooks/useViewState.jsx";
import { useRequest } from "../../hooks/useRequest.js";
import { useFrames } from "../player/useFrames.js"; // same request as the player: api.js shares it
import { templateText } from "./verdicts.js";
import { Explanation, ExternalLinks, MotionComparison, VerdictBadge, Warnings } from "./VerdictParts.jsx";
import "./verdict.css";

const COORD_DECIMALS = 5;

/** Same click → same key → no refetch. A new click or field size → new requests. */
const requestKey = (selected, fov) => (selected ? `${selected.ra}|${selected.dec}|${selected.mjd}|${fov}` : null);

function PanelShell({ children }) {
  return (
    <section className="verdict" aria-labelledby="verdict-title">
      <h2 id="verdict-title" className="verdict-title">Is it new?</h2>
      {children}
    </section>
  );
}

export default function IsItNewPanel() {
  const view = useViewState();
  const { selected, fov, ra, dec, setSelected } = view;
  // The verdict is "at a frame's date": the keyboard route checks the target on the latest pass.
  const { frames } = useFrames(view);
  const latest = frames.at(-1);
  const key = requestKey(selected, fov);

  const context = useRequest(key, (signal) =>
    getContext({ ra: selected.ra, dec: selected.dec, fov, mjd: selected.mjd }, { signal }));
  const explain = useRequest(key, (signal) =>
    getExplain({ ra: selected.ra, dec: selected.dec, mjd: selected.mjd }, { signal }));
  const track = useRequest(key, (signal) => getTrack({ ra: selected.ra, dec: selected.dec }, { signal }));

  if (!selected) {
    return (
      <PanelShell>
        <p className="verdict-muted">Click a dot on the image to check whether it's already known.</p>
        {/* Keyboard (and screen-reader) route: clicking the image needs a pointer. */}
        <button
          type="button"
          className="btn-ghost verdict-check-target"
          disabled={!latest}
          onClick={() => setSelected({ ra, dec, mjd: latest.mjd, date: latest.date })}
        >
          Check the target
        </button>
      </PanelShell>
    );
  }

  const position = (
    <p className="verdict-position">
      RA {selected.ra.toFixed(COORD_DECIMALS)}° · Dec {selected.dec.toFixed(COORD_DECIMALS)}°
      {selected.date && <> · {selected.date}</>}
    </p>
  );

  if (context.error) {
    return (
      <PanelShell>
        {position}
        <p className="verdict-error" role="alert">Couldn't check this spot: {context.error.message}</p>
        <ExternalLinks position={selected} />
      </PanelShell>
    );
  }

  if (!context.data) {
    return (
      <PanelShell>
        {position}
        <p className="verdict-muted" role="status">Checking Gaia and known asteroids…</p>
      </PanelShell>
    );
  }

  return (
    <PanelShell>
      <div className="verdict-head">
        {position}
        <VerdictBadge verdict={context.data.verdict} />
      </div>
      <Warnings warnings={context.data.warnings} />
      <Explanation template={templateText(context.data)} explain={explain.data} />
      <MotionComparison track={track.data} loading={track.loading} />
      <ExternalLinks position={selected} />
    </PanelShell>
  );
}
