// Motion track: where we measured the object in each pass, against where the catalogue motion says it
// should be. Sky convention: north up, east LEFT (so the x axis runs right-to-left).
// The catalogue line draws itself in (charts.css, .chart--track), unless motion is reduced.
import { CartesianGrid, ErrorBar, Legend, Scatter, Tooltip, XAxis, YAxis } from "recharts";
import { trackRows } from "./chartData.js";
import { ChartFrame, ChartTooltip, Dot, fixed } from "./ChartParts.jsx";
import { AXIS_LABEL_STYLE, AXIS_PROPS, INK, SERIES } from "./chartTheme.js";

const arcsec = (v) => `${v.toFixed(2)}″`;

/** Legend text in text colour; the coloured dot next to it carries the series identity. */
const legendText = (name) => <span className="chart-legend-text">{name}</span>;

const TABLE_COLUMNS = [
  { key: "date", label: "Date" },
  { key: "x", label: "East offset (″)", format: fixed(2) },
  { key: "y", label: "North offset (″)", format: fixed(2) },
  { key: "err", label: "± error (″)", format: fixed(2) },
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
    <ChartFrame
      className="chart--track"
      label="Motion track: measured positions against the catalogue prediction"
      caption="Offsets from the first pass. If the orange dots follow the blue path, it moves the way the catalogue says."
      columns={TABLE_COLUMNS}
      rows={measured}
    >
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
          name="Catalogue path"
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
    </ChartFrame>
  );
}
