/** `setValueAs` rule: empty string becomes `null` for optional string fields. */
export const nullIfEmpty = { setValueAs: (v: string) => (v === "" ? null : v) }

/** Normalizes empty/null to `null`, otherwise stringifies the value. */
export function emptyStringToNull(v: unknown): string | null {
  return v === null || v === undefined || v === "" ? null : String(v)
}

/** Converts a `FileList` (or null) to a `File[]`. */
export function fileListToArray(files: FileList | null): File[] {
  return files ? Array.from(files) : []
}

/** Parses form text into a finite number or `null` (comma as decimal separator allowed). */
export function stringToNumberOrNull(v: unknown): number | null {
  if (v === null || v === undefined || v === "") {
    return null
  }
  const raw = String(v).trim()
  if (raw === "") {
    return null
  }
  const n = Number(raw.replace(",", "."))
  return Number.isFinite(n) ? n : null
}
