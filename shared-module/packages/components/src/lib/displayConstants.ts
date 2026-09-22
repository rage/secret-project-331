// The i18next literal-string lint only runs on .tsx, so these presentational literals live here.

import type { BadgeTone } from "../components/Badge"
import type { InfoboxTone } from "../components/Infobox"
import type { MeterTone } from "../components/Meter"

/**
 * Tone names accepted by `Badge`, `Infobox` and `Meter`; each takes its own subset. Constrained to
 * those unions so a tone no component accepts fails the build instead of lingering as dead copy.
 */
export const TONE = {
  NEUTRAL: "neutral",
  INFO: "info",
  SUCCESS: "success",
  WARNING: "warning",
  DANGER: "danger",
} as const satisfies Record<string, BadgeTone | InfoboxTone | MeterTone>

/** Separator between inline meta values. */
export const MIDDLE_DOT = " · "

/** The one glyph for a value that does not exist. Drop the segment instead where a list allows it. */
export const ABSENT_LABEL = "—"
