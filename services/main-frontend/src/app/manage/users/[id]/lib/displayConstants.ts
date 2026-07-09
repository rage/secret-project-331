// Design-token and glyph constants for the user-details page. Kept as SCREAMING_CASE constants so
// they read as non-translatable values (and satisfy the i18next literal-string lint) rather than
// stray strings scattered through JSX.

/** Badge / Meter / StatTile tone values. */
export const TONE = {
  NEUTRAL: "neutral",
  INFO: "info",
  SUCCESS: "success",
  WARNING: "warning",
  DANGER: "danger",
  ALERT: "alert",
} as const

/** " · " separator between inline meta values. */
export const MIDDLE_DOT = " · "

/** Truncation ellipsis for shortened ids. */
export const ELLIPSIS = "…"
