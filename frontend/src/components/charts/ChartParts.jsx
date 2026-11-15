// Pieces shared by every chart: the frame, the hover tooltip, the dot, the table view and the empty/loading line.
import { ResponsiveContainer, ScatterChart } from "recharts";
import { CHART_HEIGHT, CHART_MARGIN, MARKER_RADIUS } from "./chartTheme.js";

/** n decimals, for table cells and tooltips. */
export const fixed = (digits) => (value) => value.toFixed(digits);

/** Brightness ± error: the same column pair and tooltip line in the spectrum and the light curve. */
export const BRIGHTNESS_COLUMNS = [
  { key: "flux", label: "Brightness", format: fixed(1) },
  { key: "error", label: "± error", format: fixed(1) },
];
export const brightnessRow = (p) => ["Brightness", `${p.flux.toFixed(1)} ± ${p.error.toFixed(1)}`];

/**
 * Every chart: an accessible figure around a scatter chart, a caption, and the numbers as a table.
 * The drawing is hidden from screen readers: the label and the table carry the data.
 * @param {{label: string, caption: React.ReactNode, columns: object[], rows: object[], className?: string,
 *          children: React.ReactNode}} props  children: the recharts axes, series etc.
 */
export function ChartFrame({ label, caption, columns, rows, className = "", children }) {
  return (
    <figure className={`chart ${className}`.trim()} aria-label={label}>
      <div aria-hidden="true">
        <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
          <ScatterChart margin={CHART_MARGIN}>{children}</ScatterChart>
        </ResponsiveContainer>
      </div>
      <figcaption className="chart-caption">{caption}</figcaption>
      <DataTable columns={columns} rows={rows} />
    </figure>
  );
}

/** Filled dot with a 2 px ring in the surface colour, so it stays readable over lines and other dots. */
export function Dot({ cx, cy, fill }) {
  if (!Number.isFinite(cx) || !Number.isFinite(cy)) return null;
  return <circle cx={cx} cy={cy} r={MARKER_RADIUS} fill={fill} stroke="var(--color-surface)" strokeWidth={2} />;
}

/**
 * Recharts tooltip content: one line per field, in text colours.
 * @param {{rows: (point: object) => [string, string][]}} props  rows(point) → [label, value] pairs
 */
export function ChartTooltip({ active, payload, rows }) {
  const point = active && payload?.[0]?.payload;
  if (!point) return null;
  return (
    <div className="chart-tooltip">
      {rows(point).map(([label, value]) => (
        <div key={label} className="chart-tooltip-row">
          <span>{label}</span>
          <strong>{value}</strong>
        </div>
      ))}
    </div>
  );
}

/**
 * The same numbers as a table, for screen readers and anyone who wants the exact values.
 * @param {{columns: {key: string, label: string, format?: (v) => string}[], rows: object[]}} props
 */
function DataTable({ columns, rows }) {
  return (
    <details className="chart-table">
      <summary>Show the numbers as a table</summary>
      <table>
        <thead>
          <tr>{columns.map((c) => <th key={c.key} scope="col">{c.label}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i}>
              {columns.map((c) => <td key={c.key}>{c.format ? c.format(row[c.key]) : row[c.key]}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </details>
  );
}

/**
 * Loading / error / no-data message, same height as a chart so the panel doesn't jump.
 * `loading` adds a thin bar that moves while we wait (still when motion is reduced).
 */
export function ChartMessage({ tone = "muted", loading = false, children }) {
  return (
    <div className={`chart-message chart-message--${tone}`} role={tone === "error" ? "alert" : "status"}>
      <p>{children}</p>
      {loading && <span className="chart-busy" aria-hidden="true"><span /></span>}
    </div>
  );
}
