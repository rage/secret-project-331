// The i18next literal-string lint only runs on .tsx, so these presentational literals live here.

export const TONE = {
  INFO: "info",
  WARNING: "warning",
  SUCCESS: "success",
  NEUTRAL: "neutral",
  ALERT: "alert",
  DANGER: "danger",
} as const

export const MIDDLE_DOT = " · "

/** Separates a from-state and a to-state in a transition. */
export const ARROW = " → "

/** The one glyph for a value that does not exist. Drop the segment instead where a list allows it. */
export const ABSENT = "—"

export const STACKED = "stacked" as const

/** `TableColumn.align` for numeric columns. */
export const ALIGN_END = "end" as const

/** `QueryResult.refreshIndicator` for polled views: a poll must not blank or freeze the page. */
export const QUIET_REFRESH = "quiet" as const

/** `RelativeTime.absoluteTime` for tables carrying several time columns. */
export const TIME_IN_TITLE = "title" as const
