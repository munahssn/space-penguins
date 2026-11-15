// Spectrum: brightness at one position in every exposure, against that exposure's wavelength.
// Dashed lines mark the ice bands SPHEREx looks for. Single series, so no legend: the tab names it.
import { CartesianGrid, ErrorBar, ReferenceLine, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis } from "recharts";
import { spectrumRows } from "./chartData.js";
import { ChartTooltip, DataTable, Dot } from "./ChartParts.jsx";
import {
  AXIS_LABEL_STYLE, AXIS_PROPS, CHART_HEIGHT, CHART_MARGIN, ICE_LINES, INK, SERIES, WAVELENGTH_DOMAIN, WAVELENGTH_TICKS,
} from "./chartTheme.js";

const fixed = (digits) => (v) => v.toFixed(digits);

const TABLE_COLUMNS = [
  { key: "wavelength_um", label: "Wavelength (µm)", format: fixed(2) },
  { key: "flux", label: "Brightness", format: fixed(1) },
  { key: "error", label: "± error", format: fixed(1) },
  { key: "det", label: "Detector" },
];

const tooltipRows = (p) => [
  ["Wavelength", `${p.wavelength_um.toFixed(2)} µm`],
  ["Brightness", `${p.flux.toFixed(1)} ± ${p.error.toFixed(1)}`],
  ["Detector", p.det],
];

/** @param {{spectrum: {points: object[]}}} props */
export default function SpectrumChart({ spectrum }) {
  const rows = spectrumRows(spectrum);

  return (
    <figure className="chart" aria-label="Spectrum: brightness against wavelength">
      {/* The drawing is hidden from screen readers: the label above and the table below carry the data. */}
      <div aria-hidden="true">
        <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
          <ScatterChart margin={CHART_MARGIN}>
            <CartesianGrid stroke={INK.grid} vertical={false} />
            <XAxis
              {...AXIS_PROPS}
              type="number"
              dataKey="wavelength_um"
              domain={WAVELENGTH_DOMAIN}
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
          </ScatterChart>
        </ResponsiveContainer>
      </div>
      <figcaption className="chart-caption">
        One dot per exposure. A dip at a dashed line can point to water, CO₂ or CO ice.
      </figcaption>
      <DataTable columns={TABLE_COLUMNS} rows={rows} />
    </figure>
  );
}
