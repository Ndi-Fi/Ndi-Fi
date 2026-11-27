# Chart / Visualization Library Usage

> Closes #150

## Overview

This document standardizes how data is visualized across the Ndi-Fi frontend. Using a single charting library with a shared set of style tokens eliminates visual inconsistency, reduces bundle size (one library instead of several), and makes it easier to maintain accessible, responsive charts.

---

## Library Choice

**Selected library: [Recharts](https://recharts.org/) (React, MIT license)**

| Criterion | Recharts | Victory | Chart.js (via react-chartjs-2) |
|---|---|---|---|
| React-native API | ✓ Declarative JSX | ✓ Declarative JSX | Imperative canvas ref |
| Bundle size (minified) | ~100 kB | ~170 kB | ~220 kB |
| Composable primitives | ✓ | ✓ | Partial |
| SVG output (accessible) | ✓ | ✓ | ✗ (canvas) |
| Responsive container | ✓ Built-in | Manual | Manual |
| Tooltip customization | ✓ Render prop | ✓ Render prop | Limited |
| Active maintenance | ✓ | Active | Active |

Recharts is chosen because it outputs SVG (enabling text-based accessibility hooks), exposes composable primitives (`LineChart`, `BarChart`, `ResponsiveContainer`, `Cell`, etc.), and has a smaller bundle than the alternatives. Its declarative API aligns with the existing React component conventions in the project.

---

## Design Tokens for Charts

All chart colors, sizes, and typography are sourced from the design token system. Never hardcode hex values in chart components.

### Color Palette

| Token | Use |
|---|---|
| `--color-chart-primary` | Main data series (single-series line/bar) |
| `--color-chart-secondary` | Comparison or secondary series |
| `--color-chart-success` | Positive values, gains |
| `--color-chart-danger` | Negative values, losses, risk |
| `--color-chart-warning` | Caution zone |
| `--color-chart-neutral` | Background bars, gridlines |
| `--color-chart-series-1` through `--color-chart-series-6` | Multi-series charts; always use in order |

Series colors are chosen to be distinguishable by users with deuteranopia and protanopia. No two adjacent series colors rely on red–green contrast alone.

### Typography

| Element | Token |
|---|---|
| Axis labels | `--font-size-xs` (11 px), `--color-text-muted` |
| Tick values | `--font-size-xs` (11 px), `--color-text-secondary` |
| Chart title | `--font-size-sm` (13 px), `--font-weight-medium`, `--color-text-primary` |
| Tooltip label | `--font-size-sm` (13 px), `--color-text-primary` |
| Tooltip value | `--font-size-sm` (13 px), `--font-weight-semibold` |

### Spacing and Grid

| Element | Value |
|---|---|
| Chart margin (top, right, bottom, left) | 8, 16, 32, 48 px |
| Gridline stroke | `--color-chart-neutral`, 1 px, dashed |
| Bar corner radius | 2 px |
| Line stroke width | 2 px |
| Dot radius (line chart) | 3 px (hover: 5 px) |

---

## Chart Patterns

### Line Chart

Used for time-series data: APY history, portfolio value over time.

```jsx
<ResponsiveContainer width="100%" height={200}>
  <LineChart data={data} margin={{ top: 8, right: 16, bottom: 32, left: 48 }}>
    <CartesianGrid strokeDasharray="4 4" stroke="var(--color-chart-neutral)" />
    <XAxis dataKey="date" tick={{ fontSize: 11, fill: "var(--color-text-muted)" }} />
    <YAxis tick={{ fontSize: 11, fill: "var(--color-text-muted)" }} />
    <Tooltip content={<ChartTooltip />} />
    <Line
      type="monotone"
      dataKey="value"
      stroke="var(--color-chart-primary)"
      strokeWidth={2}
      dot={false}
      activeDot={{ r: 5 }}
    />
  </LineChart>
</ResponsiveContainer>
```

**Rules:**
- Always wrap in `ResponsiveContainer` with `width="100%"`.
- Suppress dots by default (`dot={false}`); show on hover only (`activeDot`).
- Use `type="monotone"` for financial data to avoid visually misleading interpolation peaks.
- Format Y-axis ticks as currency (`$1.2K`) or percentage (`3.5%`) depending on the metric.

### Bar Chart

Used for categorical comparisons: protocol revenue by asset, allocation breakdown.

```jsx
<ResponsiveContainer width="100%" height={200}>
  <BarChart data={data} margin={{ top: 8, right: 16, bottom: 32, left: 48 }}>
    <CartesianGrid strokeDasharray="4 4" stroke="var(--color-chart-neutral)" vertical={false} />
    <XAxis dataKey="name" tick={{ fontSize: 11, fill: "var(--color-text-muted)" }} />
    <YAxis tick={{ fontSize: 11, fill: "var(--color-text-muted)" }} />
    <Tooltip content={<ChartTooltip />} />
    <Bar dataKey="value" fill="var(--color-chart-primary)" radius={[2, 2, 0, 0]} />
  </BarChart>
</ResponsiveContainer>
```

**Rules:**
- Use `vertical={false}` on `CartesianGrid` for bar charts (vertical gridlines are rarely useful).
- Apply `radius={[2, 2, 0, 0]}` for a subtle rounded top.
- For multi-series grouped bars, apply `--color-chart-series-N` tokens in order.
- Stacked bars should use a legend (see Legend below).

### Gauge Chart

Used for single-value indicators: health factor, utilization rate.

Recharts does not ship a gauge primitive natively. Use a `RadialBarChart` with a single data point and a fixed domain, or a custom SVG arc component.

```jsx
// Custom SVG arc gauge — preferred for precise control
<GaugeChart
  value={healthFactor}        // numeric
  min={0}
  max={3}
  zones={zones}               // [{ from, to, color }]
  label="Health Factor"
/>
```

The `GaugeChart` component is a project-local wrapper (see `src/components/charts/GaugeChart.tsx`) that renders an SVG arc with zone fills and a rotating needle. Full spec in [HEALTH_FACTOR.md](./HEALTH_FACTOR.md).

**Rules:**
- Gauge charts must include a numeric label inside the arc.
- Use zone tokens, not raw colors.
- Do not use Recharts `RadialBarChart` for health factor — it does not support zone fills cleanly.

---

## Custom Tooltip Component

All charts share one tooltip component (`ChartTooltip`) to ensure consistent styling.

```tsx
// src/components/charts/ChartTooltip.tsx
interface ChartTooltipProps {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string }>;
  label?: string;
  formatter?: (value: number, name: string) => string;
}
```

The tooltip:
- Has a white background, 1 px border in `--color-border`, 4 px border radius, and `box-shadow: var(--shadow-sm)`.
- Shows the axis label as a header in muted text.
- Shows each series as a row: `[color swatch] [series name]  [formatted value]`.
- Uses the `formatter` prop to apply currency or percentage formatting per chart.
- Never uses a colored background per zone — the swatch and text convey the series color.

---

## Empty and Loading States

### Loading State

Display a skeleton that matches the chart's approximate shape while data fetches:

| Chart type | Skeleton |
|---|---|
| Line chart | A series of horizontal shimmer bars (representing gridlines) with a wavy shimmer band |
| Bar chart | A row of equal-height shimmer rectangles |
| Gauge | A shimmer semicircle arc |

All skeletons use the shared `<Skeleton>` component with the `--color-skeleton` token and a shimmer animation. The animation is suppressed under `prefers-reduced-motion: reduce` (static muted fill instead).

The chart container preserves its height during loading so layout does not shift when data arrives (`min-height` matching the expected chart height).

### Empty State

When data is available but contains no data points, display a centered message inside the chart container:

```
┌─────────────────────────────────────┐
│                                     │
│        [Chart outline icon]         │
│       No data available yet         │
│                                     │
└─────────────────────────────────────┘
```

- The message is `"No data available yet"` for charts that fill over time (APY history).
- For user-action-dependent charts (portfolio value with no positions), use `"Make a deposit to see your portfolio history"` with a contextual CTA.
- The container retains its normal height so it does not cause layout shift relative to surrounding content.

---

## Legend

For multi-series charts, use the Recharts `<Legend>` component with the following customization:

- `iconType="circle"`, icon size 8 px.
- Positioned below the chart (`verticalAlign="bottom"`).
- Font: `--font-size-xs`, color `--color-text-secondary`.
- Each legend item provides a non-color label — the text name is always present alongside the color swatch.

---

## Accessibility

### Captions

Every chart has an accessible caption delivered via two mechanisms:

1. A visible `<figcaption>` element directly below the chart (can be `sr-only` if the chart title already serves this purpose in context).
2. An `aria-label` or `aria-describedby` on the chart's root SVG element summarizing the data, e.g.:
   ```html
   <svg aria-label="APY history: 7-day chart showing yield rising from 3.2% to 4.8%">
   ```

For charts with dynamic data, the `aria-label` is updated when data changes.

### Non-Color Encoding

Color is never the only way to distinguish data series. Each series additionally uses:

| Chart type | Non-color encoding |
|---|---|
| Multi-series line | Different `strokeDasharray` patterns (solid, dashed, dotted) |
| Multi-series bar | Different bar patterns (solid fill, hatched fill via SVG pattern) for print/grayscale |
| Gauge zones | Text label + icon (see HEALTH_FACTOR.md) |

### Keyboard Access

Chart tooltips are keyboard-accessible: Tab moves focus through data points on line and bar charts, and the tooltip fires on focus (not only on hover). This is implemented in the `ChartTooltip` component via `onFocus` / `onBlur` handlers mirroring `onMouseEnter` / `onMouseLeave`.

### Screen Reader Data Table

For any chart where the underlying data is non-trivial, include a visually hidden `<table>` adjacent to the chart containing the raw data:

```html
<div class="chart-wrapper">
  <svg aria-hidden="true"><!-- chart --></svg>
  <table class="sr-only">
    <caption>APY history, last 7 days</caption>
    <thead><tr><th>Date</th><th>APY (%)</th></tr></thead>
    <tbody><!-- data rows --></tbody>
  </table>
</div>
```

This ensures screen reader users can access exact values, not just the summary label.
