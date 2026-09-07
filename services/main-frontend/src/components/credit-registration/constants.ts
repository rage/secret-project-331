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

/** `RelativeTime.absoluteTime` for a completion or registration date, which wants no time of day. */
export const TIME_DATE = "date" as const

/** `RelativeTime.absoluteTime` for an age the reader compares against a threshold. */
export const TIME_DURATION = "duration" as const

/** `SupportMailLink.appearance` for one inside a sentence rather than beside the buttons. */
export const SUPPORT_MAIL_INLINE = "link" as const

/** `Table.density` for the operator tables: logs and queues, where rows matter more than air. */
export const DENSITY_COMPACT = "compact" as const

/** `Link.appearance` for a link that is the whole content of a table cell. */
export const LINK_QUIET = "quiet" as const

/** `Link.appearance` for a link wrapping content that sets its own colour, e.g. a badge. */
export const LINK_INHERIT = "inherit" as const

/** `Disclosure.variant` for one that sits in running text rather than as a box of its own. */
export const PLAIN_DISCLOSURE = "plain" as const

/** `RegistrationStatusState`s a surface names directly, to group rows or to badge a stage. */
export const STATE_ACTION_NEEDED = "action-needed" as const
export const STATE_FAILED = "failed" as const
export const STATE_SUPERSEDED = "superseded" as const

/** `Badge.size` for a badge that is a dense table cell's content rather than a chip in a row. */
export const BADGE_COMPACT = "compact" as const

/** `Button.variant` for the one action a surface leads with, and for the rest beside it. */
export const BUTTON_PRIMARY = "primary" as const
export const BUTTON_SECONDARY = "secondary" as const

/** `Button.size` for an action that sits inside a card or a row rather than under a form. */
export const BUTTON_SMALL = "small" as const

/** `Button.variant` for a control that reads as a link but changes what is on screen. */
export const BUTTON_TERTIARY = "tertiary" as const

/** `Button.variant` for an action that ends something and cannot be taken back. */
export const BUTTON_DESTRUCTIVE = "destructive" as const

/** `Table.responsive` for an operator table that becomes labelled cards on a phone. */
export const TABLE_STACK = "stack" as const

/** `useDateFormatter` options for a chart axis, where the year is in the heading and not the tick. */
export const DAY_AND_MONTH_FORMAT = { day: "numeric", month: "short" } as const

/** Where a student can check that credits actually arrived. */
export const SISU_URL = "https://sisu.helsinki.fi/student/frontpage"

/** Kept in one place so every page that names it can change together. */
export const SUPPORT_EMAIL = "mooc@cs.helsinki.fi"
