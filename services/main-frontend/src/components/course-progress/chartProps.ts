/** `regular` is the course module card; `small` is the chapter view. Both grow from `sm` up. */
export type ChartSize = "regular" | "small"

/** Named `ChartSize` values, for JSX where literal strings are linted. */
export const CHART_SIZE = {
  REGULAR: "regular",
  SMALL: "small",
} as const satisfies Record<string, ChartSize>

/** What every progress chart draws and says; the chart is the section's progressbar. */
export interface ProgressChartProps {
  /** Raw amount; drawn clamped to [0, max], while `valueText` keeps the real number. */
  value: number
  /** Must be positive; sections hide the chart otherwise. */
  max: number
  /** Threshold in the same unit as `value`; `null` draws no tick. */
  required: number | null
  tickLabel: string | null
  valueText: string
  tooltipLines: string[]
  /** Id of the section heading that names the chart. */
  labelledBy: string
  size: ChartSize
}
