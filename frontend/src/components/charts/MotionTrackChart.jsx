// Motion track: where we measured the object in each pass, against where the catalog motion says it
// should be. Sky convention: north up, east LEFT (so the x axis runs right-to-left).
import { CartesianGrid, ErrorBar, Legend, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis } from "recharts";
import { trackRows } from "./chartData.js";
import { ChartTooltip, DataTable, Dot } from "./ChartParts.jsx";
import { AXIS_LABEL_STYLE, AXIS_PROPS, CHART_HEIGHT, CHART_MARGIN, INK, SERIES } from "./chartTheme.js";

const arcsec = (v) => `${v.toFixed(2)}″`;

/** Legend text in text colour; the coloured dot next to it carries the series identity. */
const legendText = (name) => <span className="chart-legend-text">{name}</span>;

const TABLE_COLUMNS = [
  { key: "date", label: "Date" },
  { key: "x", label: "East offset (″)", format: (v) => v.toFixed(2) },
  { key: "y", label: "North offset (″)", format: (v) => v.toFixed(2) },
  { key: "err", label: "± error (″)", format: (v) => v.toFixed(2) },
];

const tooltipRows = (p) => [
  ["Date", p.date],
  ["East", arcsec(p.x)],
  ["North", arcsec(p.y)],
  ...(p.err !== undefined ? [["± error", arcsec(p.err)]] : []),
];

/** @param {{track: {measured: object[], catalog_pm: object|null}}} props */
export default function MotionTrackChart({ track }) {
  const { measured, predicted } = trackRows(track);

  return (
    <figure className="chart" aria-label="Motion track: measured positions against the catalog prediction">
      {/* The drawing is hidden from screen readers: the label above and the table below carry the data. */}
      <div aria-hidden="true">
        <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
          <ScatterChart margin={CHART_MARGIN}>
            <CartesianGrid stroke={INK.grid} />
            <XAxis
              {...AXIS_PROPS}
              type="number"
              dataKey="x"
              reversed
              tickFormatter={(v) => v.toFixed(0)}
              label={{ ...AXIS_LABEL_STYLE, value: "← east (″)", position: "insideBottom", offset: -12 }}
            />
            <YAxis
              {...AXIS_PROPS}
              type="number"
              dataKey="y"
              width={44}
              tickFormatter={(v) => v.toFixed(1)}
              label={{ ...AXIS_LABEL_STYLE, value: "north (″)", angle: -90, position: "insideLeft" }}
            />
            <Tooltip content={<ChartTooltip rows={tooltipRows} />} cursor={false} />
            <Legend verticalAlign="top" height={24} iconType="circle" formatter={legendText} wrapperStyle={{ fontSize: 12 }} />
            {predicted.length > 0 && (
              <Scatter
                name="Catalog prediction"
                data={predicted}
                fill={SERIES.predicted}
                line={{ stroke: SERIES.predicted, strokeWidth: 2, strokeDasharray: "6 4" }}
                shape={<Dot />}
                isAnimationActive={false}
              />
            )}
            <Scatter name="Measured" data={measured} fill={SERIES.measured} shape={<Dot />} isAnimationActive={false}>
              <ErrorBar dataKey="err" direction="x" stroke={SERIES.measured} strokeWidth={1} width={0} />
              <ErrorBar dataKey="err" direction="y" stroke={SERIES.measured} strokeWidth={1} width={0} />
            </Scatter>
          </ScatterChart>
        </ResponsiveContainer>
      </div>
      <figcaption className="chart-caption">
        Offsets from the first pass. If the orange dots follow the blue path, the object moves as the catalog says.
      </figcaption>
      <DataTable columns={TABLE_COLUMNS} rows={measured} />
    </figure>
  );
}
