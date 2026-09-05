// The i18next literal-string lint only runs on .tsx, so these presentational literals live here.

/** Tone names accepted by `Badge`, `Infobox`, `Meter` and `StatTile`; each takes its own subset. */
export const TONE = {
  NEUTRAL: "neutral",
  INFO: "info",
  SUCCESS: "success",
  WARNING: "warning",
  DANGER: "danger",
  ALERT: "alert",
} as const

/** Separator between inline meta values. */
export const MIDDLE_DOT = " · "

/** The one glyph for a value that does not exist. Drop the segment instead where a list allows it. */
export const ABSENT_LABEL = "—"
