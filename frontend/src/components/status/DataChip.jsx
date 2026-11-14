import { useServerStatus } from "../../hooks/useServerStatus.jsx";
import "./status.css";

function chipText({ state, health }) {
  if (state === "ok") {
    const date = health.latest_data_date ? ` · ${health.latest_data_date}` : "";
    return `Data: ${health.release}${date}`;
  }
  if (state === "unreachable") return "Data: offline";
  return "Data: connecting…";
}

/** "Data: dr1+qr3 · 2026-05-20" from /api/health. */
export default function DataChip() {
  const status = useServerStatus();
  const isError = status.state === "unreachable";

  return (
    <span className={`chip ${isError ? "chip-error" : ""}`.trim()} title="SPHEREx data release · latest date">
      {chipText(status)}
    </span>
  );
}
