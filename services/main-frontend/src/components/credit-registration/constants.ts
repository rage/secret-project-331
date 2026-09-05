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

/** `RelativeTime.absoluteTime` for a date the reader has to reconcile rather than watch. */
export const TIME_COMPACT = "compact" as const

/** `Table.density` for the operator tables: logs and queues, where rows matter more than air. */
export const DENSITY_COMPACT = "compact" as const

/** `Link.appearance` for a link that is the whole content of a table cell. */
export const LINK_QUIET = "quiet" as const

/** `Link.appearance` for a link wrapping content that sets its own colour, e.g. a badge. */
export const LINK_INHERIT = "inherit" as const

/** `Disclosure.variant` for one that sits in running text rather than as a box of its own. */
export const PLAIN_DISCLOSURE = "plain" as const

/** `Badge.size` for a badge that is a dense table cell's content rather than a chip in a row. */
export const BADGE_COMPACT = "compact" as const

/** Where a student can check that credits actually arrived. */
export const SISU_URL = "https://sisu.helsinki.fi/student/frontpage"

/** Kept in one place so every page that names it can change together. */
export const SUPPORT_EMAIL = "mooc@cs.helsinki.fi"
