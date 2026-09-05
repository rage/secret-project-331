const PERCENT = 100

/** A percent value as display text; the space before the sign is what the admin copy renders. */
export const formatPercent = (percent: number): string => `${Math.round(percent)} %`

/** `part` out of `whole` as whole percent. `whole` must be non-zero. */
export const formatSharePercent = (part: number, whole: number): string =>
  formatPercent((part / whole) * PERCENT)
