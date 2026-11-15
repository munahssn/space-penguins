// Light curve: brightness per survey pass, for variable stars like RW Aurigae and R Draconis.
import { CartesianGrid, ErrorBar, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis } from "recharts";
import { lightcurveRows, mjdToDate } from "./chartData.js";
import { ChartTooltip, DataTable, Dot } from "./ChartParts.jsx";
import { AXIS_LABEL_STYLE, AXIS_PROPS, CHART_HEIGHT, CHART_MARGIN, INK, SERIES } from "./chartTheme.js";

const TABLE_COLUMNS = [
  { key: "date", label: "Date" },
  { key: "flux", label: "Brightness", format: (v) => v.toFixed(1) },
  { key: "error", label: "± error", format: (v) => v.toFixed(1) },
];

const tooltipRows = (p) => [
  ["Date", p.date],
  ["Brightness", `${p.flux.toFixed(1)} ± ${p.error.toFixed(1)}`],
];

/** @param {{lightcurve: {points: object[]}, det: string}} props */
export default function LightCurveChart({ lightcurve, det }) {
  const rows = lightcurveRows(lightcurve);

  return (
    <figure className="chart" aria-label={`Light curve in detector ${det}: brightness over time`}>
      {/* The drawing is hidden from screen readers: the label above and the table below carry the data. */}
      <div aria-hidden="true">
        <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
          <ScatterChart margin={CHART_MARGIN}>
            <CartesianGrid stroke={INK.grid} vertical={false} />
            <XAxis
              {...AXIS_PROPS}
              type="number"
              dataKey="mjd"
              domain={["dataMin - 30", "dataMax + 30"]}
              tickFormatter={(mjd) => mjdToDate(mjd).slice(0, 7)}
              label={{ ...AXIS_LABEL_STYLE, value: "Date", position: "insideBottom", offset: -12 }}
            />
            <YAxis {...AXIS_PROPS} type="number" dataKey="flux" width={44} />
            <Tooltip content={<ChartTooltip rows={tooltipRows} />} cursor={false} />
            <Scatter
              data={rows}
              fill={SERIES.measured}
              line={{ stroke: SERIES.measured, strokeWidth: 2 }}
              shape={<Dot />}
              isAnimationActive={false}
            >
              <ErrorBar dataKey="error" direction="y" stroke={SERIES.measured} strokeWidth={1} width={0} />
            </Scatter>
          </ScatterChart>
        </ResponsiveContainer>
      </div>
      <figcaption className="chart-caption">
        Detector {det}, one dot per survey pass. A variable star rises and falls; a steady one stays flat.
      </figcaption>
      <DataTable columns={TABLE_COLUMNS} rows={rows} />
    </figure>
  );
}
