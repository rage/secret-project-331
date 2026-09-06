const PERCENT = 100

/** A percent value (0-100) as display text, in `locale`'s own percent convention. */
export const formatPercent = (percent: number, locale?: string): string =>
  new Intl.NumberFormat(locale, { style: "percent", maximumFractionDigits: 0 }).format(
    percent / PERCENT,
  )

/** `part` out of `whole` as whole percent, in `locale`'s own percent convention. `whole` must be non-zero. */
export const formatSharePercent = (part: number, whole: number, locale?: string): string =>
  formatPercent((part / whole) * PERCENT, locale)
