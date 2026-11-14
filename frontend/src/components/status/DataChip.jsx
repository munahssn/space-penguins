import { useHealth } from "../../hooks/useHealth.js";
import "./status.css";

/** "Data: dr1+qr3 · 2026-05-20" from /api/health. */
export default function DataChip() {
  const { health, error } = useHealth();

  let text = "Data: loading…";
  if (error) text = "Data: offline";
  else if (health) text = `Data: ${health.release} · ${health.latest_data_date}`;

  return (
    <span className={`chip ${error ? "chip-error" : ""}`.trim()} title="SPHEREx data release · latest date">
      {text}
    </span>
  );
}
