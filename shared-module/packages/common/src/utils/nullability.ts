export function assertNotNullOrUndefined<T>(value: T | null | undefined): T {
  if (value === null || value === undefined) {
    // eslint-disable-next-line i18next/no-literal-string
    throw new Error("Value cannot be null or undefined.")
  }
  return value
}
