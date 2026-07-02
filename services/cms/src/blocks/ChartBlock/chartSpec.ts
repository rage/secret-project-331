// Pure helpers for moving chart data between an inline Vega-Lite spec and a separate data file.
// Kept free of React/WordPress imports so they can be unit tested in isolation.

const CSV = "csv"
const TSV = "tsv"
const JSON_EXT = "json"
const JSON_MIME = "application/json"
const TEXT_MIME = "text/plain"

export interface ExtractedData {
  specWithoutData: Record<string, unknown>
  contents: string
  extension: string
  mime: string
}

/** Extracts top-level inline `data.values`; null if none, unparseable, or data is already a URL. */
export const extractInlineData = (specString: string): ExtractedData | null => {
  let parsed: Record<string, unknown>
  try {
    parsed = JSON.parse(specString)
  } catch {
    return null
  }
  const data = parsed.data as { values?: unknown; format?: { type?: string } } | undefined
  const values = data?.values
  if (values === undefined || values === null) {
    return null
  }
  if (Array.isArray(values) ? values.length === 0 : values === "") {
    return null
  }
  const { data: _omitted, ...specWithoutData } = parsed
  if (typeof values === "string") {
    const formatType = data?.format?.type
    const extension = formatType === CSV ? CSV : formatType === TSV ? TSV : JSON_EXT
    return {
      specWithoutData,
      contents: values,
      extension,
      mime: extension === JSON_EXT ? JSON_MIME : TEXT_MIME,
    }
  }
  return {
    specWithoutData,
    contents: JSON.stringify(values, null, 2),
    extension: JSON_EXT,
    mime: JSON_MIME,
  }
}

/**
 * Format from the file extension, set explicitly because prod URLs may carry query params that
 * defeat Vega's extension sniffing.
 */
export const dataFormatForUrl = (url: string): { type: string } | undefined => {
  const path = url.split("?")[0].toLowerCase()
  if (path.endsWith(`.${CSV}`)) {
    return { type: CSV }
  }
  if (path.endsWith(`.${TSV}`)) {
    return { type: TSV }
  }
  if (path.endsWith(`.${JSON_EXT}`)) {
    return { type: JSON_EXT }
  }
  return undefined
}

/** Spec with its `data` pointed at the given URL; null if the spec text isn't valid JSON. */
export const specWithDataUrl = (
  specString: string,
  url: string,
): Record<string, unknown> | null => {
  let parsed: Record<string, unknown>
  try {
    parsed = JSON.parse(specString)
  } catch {
    return null
  }
  const format = dataFormatForUrl(url)
  return { ...parsed, data: { url, ...(format ? { format } : {}) } }
}

/** The data URL referenced by a spec, if any. */
export const dataUrlFromSpec = (specString: string): string | undefined => {
  try {
    const parsed = JSON.parse(specString) as { data?: { url?: unknown } }
    return typeof parsed.data?.url === "string" ? parsed.data.url : undefined
  } catch {
    return undefined
  }
}
