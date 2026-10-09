import { useEffect, useRef, useState } from "react"

import type {
  CreditRegistrationHistory,
  CreditRegistrationHistoryDay,
} from "@/generated/api/types.generated"
import { baseTheme } from "@/shared-module/common/styles"

const MS_PER_DAY = 86_400_000
const DAY_LENGTH = 10

/** The history lengths a chart offers, in days. */
export const MONTH_DAYS = 30
export const QUARTER_DAYS = 90
export const YEAR_DAYS = 365

/** The history range chips, shortest first. */
export const HISTORY_RANGES = [
  { days: MONTH_DAYS, labelKey: "credit-registration-admin-window-chip-month" },
  { days: QUARTER_DAYS, labelKey: "credit-registration-admin-window-chip-quarter" },
  { days: YEAR_DAYS, labelKey: "credit-registration-admin-window-chip-year" },
] as const

/** Chart ink read off the theme; ECharts cannot resolve a CSS variable. */
export const GRID_LINE_COLOR = baseTheme.colors.gray[75]
export const AXIS_TEXT_COLOR = baseTheme.colors.gray[500]
export const MINOR_TEXT_COLOR = baseTheme.colors.gray[400]
export const LINE_WIDTH = 2
const GAP_OPACITY = 0.7
/** Ends the y-axis on a number a reader can divide by, rather than on the tallest day's depth. */
const NICE_STEPS = [1, 2, 5, 10]

/** ECharts option value, not user-facing copy. */
export const AXIS_TOOLTIP = { trigger: "axis" } as const

/** One day on a history chart's axis. */
export interface DayPoint {
  day: string
  hasSnapshot: boolean
}

/** A history's days, gaps included, and the snapshot for each that has one. */
export interface HistoryDays {
  points: DayPoint[]
  days: string[]
  snapshotOf: (day: string) => CreditRegistrationHistoryDay | undefined
}

/**
 * Every day in the range up to the last snapshot, so a day the snapshot phase missed stays a gap
 * rather than a zero, and the series ends on a day there is a depth for.
 */
export const readHistoryDays = (history: CreditRegistrationHistory): HistoryDays => {
  const byDate = new Map(history.days.map((day) => [day.snapshot_date, day]))
  const lastSnapshot = history.days.at(-1)?.snapshot_date
  const end = Math.min(
    new Date(history.to).getTime(),
    lastSnapshot === undefined ? -Infinity : new Date(lastSnapshot).getTime(),
  )
  const points: DayPoint[] = []
  for (let day = new Date(history.from).getTime(); day <= end; day += MS_PER_DAY) {
    // `toISOString` is safe here: the endpoint's dates are plain UTC days with no offset to lose.
    const isoDay = new Date(day).toISOString().slice(0, DAY_LENGTH)
    points.push({ day: isoDay, hasSnapshot: byDate.has(isoDay) })
  }
  return {
    points,
    days: points.map((point) => point.day),
    snapshotOf: (day) => byDate.get(day),
  }
}

/** Contiguous runs of days with no snapshot, as `[from, to]` pairs for a `markArea`. */
const missingRanges = (points: DayPoint[]): [string, string][] => {
  const ranges: [string, string][] = []
  let open: [string, string] | null = null
  for (const point of points) {
    if (point.hasSnapshot) {
      open = null
    } else if (open === null) {
      open = [point.day, point.day]
      ranges.push(open)
    } else {
      open[1] = point.day
    }
  }
  return ranges
}

/** Shades the days with no snapshot, or null when there are none. */
export const missingDaysMarkArea = (points: DayPoint[], label: string) => {
  const gaps = missingRanges(points)
  return gaps.length === 0
    ? null
    : {
        silent: true,
        itemStyle: { color: GRID_LINE_COLOR, opacity: GAP_OPACITY },
        label: { show: false },
        data: gaps.map(([from, to]): [{ xAxis: string; name: string }, { xAxis: string }] => [
          { xAxis: from, name: label },
          { xAxis: to },
        ]),
      }
}

/**
 * Whether a line has two adjacent days to draw a segment between. `connectNulls` is off so a
 * missed snapshot stays a gap, so an isolated day paints nothing unless drawn as a symbol.
 */
export const hasDrawableSegment = (points: (number | null)[]): boolean =>
  points.some((point, index) => point !== null && (points[index + 1] ?? null) !== null)

/** The next 1, 2 or 5 above `value`, so the axis ends on a number worth reading. */
export const niceMax = (value: number): number => {
  const magnitude = 10 ** Math.floor(Math.log10(Math.max(value, 1)))
  const step = NICE_STEPS.find((candidate) => value <= candidate * magnitude) ?? 10
  return step * magnitude
}

/** The container's width once it is on screen; 0 before the first measurement. */
export const useMeasuredWidth = (): [React.RefObject<HTMLDivElement | null>, number] => {
  const ref = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(0)
  useEffect(() => {
    const element = ref.current
    if (element === null || typeof ResizeObserver === "undefined") {
      return
    }
    const observer = new ResizeObserver(() => setWidth(element.clientWidth))
    observer.observe(element)
    setWidth(element.clientWidth)
    return () => observer.disconnect()
  }, [])
  return [ref, width]
}
