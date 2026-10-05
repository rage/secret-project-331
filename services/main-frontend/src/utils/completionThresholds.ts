/** Points are stored to two decimals, so a whole score must not render as "5.00". */
export const formatPoints = (points: number, locale: string | undefined): string =>
  points.toLocaleString(locale, { maximumFractionDigits: 2 })

/** An automatic-completion threshold of 0 or none asks nothing, so it is not shown. */
export const hasThreshold = (required: number | null | undefined): required is number =>
  required !== null && required !== undefined && required > 0

/**
 * Whether `given` meets an automatic-completion threshold, judged as the backend does: it
 * truncates the score to a whole number before comparing. The API rounds points to two decimals,
 * so a raw 129.996 arrives as 130 and reads as met although the backend sees 129.
 */
export const meetsThreshold = (required: number, given: number): boolean =>
  Math.trunc(given) >= required
