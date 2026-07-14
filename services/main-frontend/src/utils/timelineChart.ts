// Shared palette + constants for the user activity/completion timelines. Colors use baseTheme tokens
// where one matches; the rgba fills and SCREAMING_CASE echarts enum strings stay literal (both ignored
// by the i18next literal-string lint).

import { escape } from "lodash"

import { baseTheme } from "@/shared-module/common/styles"

// One categorical palette, shared by the cross-course Gantt (indexed by course order) and the per-course
// timeline (indexed by module order). Near-collision hues are omitted so adjacent series stay distinct.
export const SERIES_COLORS = [
  baseTheme.colors.blue[600],
  baseTheme.colors.green[600],
  baseTheme.colors.purple[600],
  baseTheme.colors.crimson[600],
  baseTheme.colors.red[600],
  baseTheme.colors.gray[500],
  baseTheme.colors.blue[800],
  baseTheme.colors.green[800],
]

// Non-translatable echarts enum strings, grouped under SCREAMING_CASE keys so the i18next
// literal-string lint (which ignores such values) leaves them alone.
export const ECHARTS = {
  OVERFLOW_TRUNCATE: "truncate",
  ALIGN_LEFT: "left",
  ALIGN_RIGHT: "right",
  VALIGN_MIDDLE: "middle",
  VALIGN_TOP: "top",
  TRIGGER_ITEM: "item",
  FILTER_WEAK: "weakFilter",
  SYMBOL_NONE: "none",
  SYMBOL_CIRCLE: "circle",
  SYMBOL_EMPTY_CIRCLE: "emptyCircle",
  SYMBOL_DIAMOND: "diamond",
  SYMBOL_PIN: "pin",
  PIN_OFFSET_Y: "-90%",
  LABEL_END: "end",
} as const

// echarts time-axis label templates, keyed by tick granularity. Day ticks show the month too ("Feb 5")
// and the year boundary shows a month ("Jan 2026") so the axis never starts with a bare "2026".
export const TIME_AXIS_LABEL = {
  year: "{MMM} {yyyy}",
  month: "{MMM}",
  day: "{MMM} {d}",
  hour: "{HH}:{mm}",
  minute: "{HH}:{mm}",
} as const

/** Subtle alternating background bands for the time axis (splitArea): faint gray tint / transparent. */
export const SPLIT_AREA_COLORS = ["rgba(83,90,102,0.04)", "rgba(255,255,255,0)"]

/** Line break for the (raw-HTML) echarts tooltip strings both timelines build. */
export const LINE_BREAK = "<br />"

/**
 * Escape a string for safe interpolation into an echarts tooltip. Tooltip `formatter` return values are
 * inserted as raw HTML, so teacher-authored course/module names must be escaped to avoid stored XSS.
 * Delegates to lodash's `escape` (same five entities) to keep a single HTML escaper in the codebase.
 */
export const escapeHtml = escape

/** Faint neutral fill for the enrolled→last-activity span track behind the density violins. */
export const TRACK_FILL = "rgba(83,90,102,0.10)"

/** Fallback color for marks with no module. */
export const NEUTRAL_MARK_COLOR = baseTheme.colors.gray[400]

/** Non-alarming accent for completions still awaiting review (info tone, not error red). */
export const REVIEW_ACCENT = baseTheme.colors.blue[700]

/** Palette lookup that wraps around for indices past the palette length. */
export function colorAt(palette: string[], index: number): string {
  return palette[((index % palette.length) + palette.length) % palette.length]
}

// Event clusters in seed/test data can span only seconds; left to auto-scale a time axis stretches
// that tiny span across the full width. Enforce a minimum visible span (plus a small margin) so short
// bursts render as tight clusters instead of one spread-out row.
const MIN_SPAN_MS = 24 * 60 * 60 * 1000
const MARGIN_RATIO = 0.05

/** Padded `{ min, max }` timestamps for an echarts time axis given the events plotted on it. */
export function timeAxisBounds(times: number[]): { min: number; max: number } {
  if (times.length === 0) {
    return { min: 0, max: MIN_SPAN_MS }
  }
  let min = Math.min(...times)
  let max = Math.max(...times)
  const span = max - min
  if (span < MIN_SPAN_MS) {
    const extra = (MIN_SPAN_MS - span) / 2
    min -= extra
    max += extra
  }
  const margin = (max - min) * MARGIN_RATIO
  return { min: min - margin, max: max + margin }
}
