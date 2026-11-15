// Spectrum: brightness at one position in every exposure, against that exposure's wavelength.
// Dashed lines mark the ice bands SPHEREx looks for. Single series, so no legend: the tab names it.
import { CartesianGrid, ErrorBar, ReferenceLine, Scatter, Tooltip, XAxis, YAxis } from "recharts";
import { WAVELENGTH_RANGE_UM } from "../../api/spherex.js";
import { spectrumRows } from "./chartData.js";
import { BRIGHTNESS_COLUMNS, ChartFrame, ChartTooltip, Dot, brightnessRow, fixed } from "./ChartParts.jsx";
import { AXIS_LABEL_STYLE, AXIS_PROPS, ICE_LINES, INK, SERIES, WAVELENGTH_TICKS } from "./chartTheme.js";

const TABLE_COLUMNS = [
  { key: "wavelength_um", label: "Wavelength (µm)", format: fixed(2) },
  ...BRIGHTNESS_COLUMNS,
  { key: "det", label: "Detector" },
];

const tooltipRows = (p) => [
  ["Wavelength", `${p.wavelength_um.toFixed(2)} µm`],
  brightnessRow(p),
  ["Detector", p.det],
];

/** @param {{spectrum: {points: object[]}}} props */
export default function SpectrumChart({ spectrum }) {
  const rows = spectrumRows(spectrum);

  return (
    <ChartFrame
      label="Spectrum: brightness against wavelength"
      caption="One dot per exposure. A dip at a dashed line can point to water, CO₂ or CO ice."
      columns={TABLE_COLUMNS}
      rows={rows}
    >
      <CartesianGrid stroke={INK.grid} vertical={false} />
      <XAxis
        {...AXIS_PROPS}
        type="number"
        dataKey="wavelength_um"
        domain={WAVELENGTH_RANGE_UM}
        ticks={WAVELENGTH_TICKS}
        label={{ ...AXIS_LABEL_STYLE, value: "Wavelength (µm)", position: "insideBottom", offset: -12 }}
      />
      <YAxis {...AXIS_PROPS} type="number" dataKey="flux" width={44} />
      {ICE_LINES.map(({ wavelength, label }) => (
        <ReferenceLine
          key={label}
          x={wavelength}
          stroke={INK.reference}
          strokeDasharray="4 4"
          label={{ value: label, position: "top", fill: INK.axis, fontSize: 11 }}
        />
      ))}
      <Tooltip content={<ChartTooltip rows={tooltipRows} />} cursor={false} />
      <Scatter data={rows} fill={SERIES.measured} shape={<Dot />} isAnimationActive={false}>
        <ErrorBar dataKey="error" direction="y" stroke={SERIES.measured} strokeWidth={1} width={0} />
      </Scatter>
    </ChartFrame>
  );
}
