// Page title above the player: the popular find's name (or "Sky position" anywhere else) and where it is.
import { useViewState } from "../../hooks/useViewState.jsx";
import { useCurrentTarget } from "../search/useTargets.js";
import { formatPosition } from "./format.js";
import "./target.css";

export default function TargetHeading() {
  const { ra, dec } = useViewState();
  const target = useCurrentTarget();

  return (
    <div className="target-heading">
      <p className="kicker">{formatPosition(ra, dec)}</p>
      <h1 className="target-name">{target?.name ?? "Sky position"}</h1>
    </div>
  );
}
