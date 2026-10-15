/** Parses a `yyyy-MM` string into numeric year/month parts. */
export function parseYearMonth(
  value: string | null | undefined,
): { year: number; month: number } | null {
  if (!value) {
    return null
  }

  const match = /^(\d{4})-(\d{2})$/.exec(value)
  if (!match) {
    return null
  }

  const year = Number(match[1])
  const month = Number(match[2])
  if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12) {
    return null
  }

  return { year, month }
}

/** Serializes numeric year/month parts into a `yyyy-MM` string. */
export function serializeYearMonth(year: number, month: number): string {
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}`
}
