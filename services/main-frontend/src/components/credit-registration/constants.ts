// The i18next literal-string lint only runs on .tsx, so these presentational literals live here.

export { ABSENT_LABEL as ABSENT, MIDDLE_DOT, TONE } from "@/shared-module/components"

/** How much of a uuid an operator needs to recognise a row in a chip or a target label. */
export const ID_PREFIX_LENGTH = 8

/** Separates a from-state and a to-state in a transition. */
export const ARROW = " → "

export const STACKED = "stacked" as const

/** `TableColumn.align` for numeric columns. */
export const ALIGN_END = "end" as const

/** `QueryResult.refreshIndicator` for polled views: a poll must not blank or freeze the page. */
export const QUIET_REFRESH = "quiet" as const

/** `RelativeTime.absoluteTime` for tables carrying several time columns. */
export const TIME_IN_TITLE = "title" as const
