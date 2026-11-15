// Light curve: brightness per survey pass, for variable stars like RW Aurigae and R Draconis.
import { CartesianGrid, ErrorBar, Scatter, Tooltip, XAxis, YAxis } from "recharts";
import { lightcurveRows, mjdToDate } from "./chartData.js";
import { BRIGHTNESS_COLUMNS, ChartFrame, ChartTooltip, Dot, brightnessRow } from "./ChartParts.jsx";
import { AXIS_LABEL_STYLE, AXIS_PROPS, INK, SERIES } from "./chartTheme.js";

const TABLE_COLUMNS = [{ key: "date", label: "Date" }, ...BRIGHTNESS_COLUMNS];

const tooltipRows = (p) => [["Date", p.date], brightnessRow(p)];

/** @param {{lightcurve: {points: object[]}, det: string}} props */
export default function LightCurveChart({ lightcurve, det }) {
  const rows = lightcurveRows(lightcurve);

  return (
    <ChartFrame
      label={`Light curve in detector ${det}: brightness over time`}
      caption={`Detector ${det}, one dot per survey pass. A variable star rises and falls; a steady one stays flat.`}
      columns={TABLE_COLUMNS}
      rows={rows}
    >
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
    </ChartFrame>
  );
}
