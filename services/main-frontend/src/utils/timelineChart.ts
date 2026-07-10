// Shared palette + symbol constants for the user activity/completion timelines. SCREAMING_CASE keeps
// the literal values out of the i18next literal-string lint.

/** Distinct, legible hues; one per module (course-specific timeline) indexed by module order. */
export const MODULE_COLORS = [
  "#1f6964",
  "#2563eb",
  "#b45309",
  "#7c3aed",
  "#be123c",
  "#0e7490",
  "#4d7c0f",
  "#9d174d",
]

/** Distinct hues; one per course (cross-course Gantt) indexed by course order. */
export const COURSE_COLORS = [
  "#2563eb",
  "#1f6964",
  "#7c3aed",
  "#b45309",
  "#0e7490",
  "#be123c",
  "#4d7c0f",
  "#9d174d",
]

// Non-translatable echarts enum strings, grouped under SCREAMING_CASE keys so the i18next
// literal-string lint (which ignores such values) leaves them alone.
export const ECHARTS = {
  OVERFLOW_TRUNCATE: "truncate",
  ALIGN_LEFT: "left",
  VALIGN_MIDDLE: "middle",
  TRIGGER_ITEM: "item",
  FILTER_WEAK: "weakFilter",
  SYMBOL_NONE: "none",
  SYMBOL_PIN: "pin",
  SYMBOL_CIRCLE: "circle",
  SYMBOL_TRIANGLE: "triangle",
  SYMBOL_DIAMOND: "diamond",
  SYMBOL_RECT: "rect",
  SYMBOL_ARROW: "arrow",
} as const

/** Scatter symbol per submission attempt ordinal (0-based); cycles for high retry counts. */
export const ATTEMPT_SYMBOLS = [
  ECHARTS.SYMBOL_CIRCLE,
  ECHARTS.SYMBOL_TRIANGLE,
  ECHARTS.SYMBOL_DIAMOND,
  ECHARTS.SYMBOL_RECT,
  ECHARTS.SYMBOL_PIN,
  ECHARTS.SYMBOL_ARROW,
]

/** Fallback color for marks with no module. */
export const NEUTRAL_MARK_COLOR = "#767b85"

/** Module-completion marker color, and the emphasis color for completions still needing review. */
export const COMPLETION_COLOR = "#1f6964"
export const NEEDS_REVIEW_COLOR = "#9e341f"

/** Palette lookup that wraps around for indices past the palette length. */
export function colorAt(palette: string[], index: number): string {
  return palette[((index % palette.length) + palette.length) % palette.length]
}

/** Attempt symbol for a 0-based attempt index, cycling past the list length. */
export function attemptSymbol(index: number): string {
  return ATTEMPT_SYMBOLS[
    ((index % ATTEMPT_SYMBOLS.length) + ATTEMPT_SYMBOLS.length) % ATTEMPT_SYMBOLS.length
  ]
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
