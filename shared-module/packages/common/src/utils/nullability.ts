export function assertNotNullOrUndefined<T>(value: T | null | undefined): T {
  if (value === null || value === undefined) {
    throw new Error("Value cannot be null or undefined.")
  }
  return value
}
