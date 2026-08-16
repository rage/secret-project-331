// Pure helpers for moving chart data between an inline Vega-Lite spec and a separate data file.
// Kept free of React/WordPress imports so they can be unit tested in isolation.

const CSV = "csv"
const TSV = "tsv"
const JSON_EXT = "json"
const JSON_MIME = "application/json"
const TEXT_MIME = "text/plain"

export const VEGA_LITE_SCHEMA_URL = "https://vega.github.io/schema/vega-lite/v6.json"

/** Default block height in px, used until the teacher picks one. */
export const DEFAULT_CHART_HEIGHT = 300

const MULTI_VIEW_KEYS = ["vconcat", "hconcat", "concat", "facet", "repeat"] as const

/**
 * Whether the spec composes multiple views (concat/facet/repeat). Vega-Lite ignores a top-level
 * `height` on such specs, so they can't be resized through the spec — the render layer scales
 * them with CSS instead.
 */
export const isMultiViewSpec = (parsed: unknown): boolean =>
  typeof parsed === "object" &&
  parsed !== null &&
  MULTI_VIEW_KEYS.some((key) => key in (parsed as Record<string, unknown>))

const VIEW_KEYS = [
  "mark",
  "layer",
  "vconcat",
  "hconcat",
  "concat",
  "facet",
  "repeat",
  "spec",
] as const

/**
 * Whether the spec actually defines a chart view. A freshly data-attached spec is just
 * `{ $schema, data }` with no view yet — not broken, just not written. Used to avoid flagging that
 * incomplete state as a render error.
 */
export const specDefinesView = (parsed: unknown): boolean =>
  typeof parsed === "object" &&
  parsed !== null &&
  VIEW_KEYS.some((key) => key in (parsed as Record<string, unknown>))

// Keys whose values are themselves view specifications, each of which may carry its own data.
const SUB_SPEC_KEYS = ["layer", "hconcat", "vconcat", "concat", "spec"] as const

/**
 * Whether the spec has a data source anywhere. Vega-Lite allows `data` on any view, not just the
 * top level — a layered or concatenated chart whose views come from different files (what Altair
 * writes for such charts) has no top-level `data` at all, so only checking there would call a
 * perfectly good chart data-less.
 */
export const specHasData = (parsed: unknown): boolean => {
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    return false
  }
  const record = parsed as Record<string, unknown>
  if (record.data) {
    return true
  }
  return SUB_SPEC_KEYS.some((key) => {
    const value = record[key]
    return Array.isArray(value) ? value.some((view) => specHasData(view)) : specHasData(value)
  })
}

/**
 * Whether the chart is still at its automatic size. Blocks saved before the `heightIsAuto`
 * attribute existed have no flag, and there the default height was what marked "not sized yet".
 */
export const isAutoHeight = (heightAttr: number, heightIsAuto: boolean | undefined): boolean =>
  heightIsAuto ?? heightAttr === DEFAULT_CHART_HEIGHT

export interface ChartLayout {
  /** Height of the chart's box in px — the dimension the resizable bottom edge controls. */
  boxHeightPx: number
  /** Uniform CSS scale that fits a multi-view chart into boxHeightPx; always 1 for single-view. */
  scale: number
}

/**
 * Resolves the chart's box height and CSS scale.
 *
 * Single-view specs size themselves via the injected height, so the box is `heightAttr` and no
 * scaling is needed. Multi-view specs render at their natural height (`naturalHeightPx`); we scale
 * them uniformly to the requested height, or show them at full natural size while `heightIsAuto`
 * says the teacher hasn't chosen one.
 */
export const resolveChartLayout = (args: {
  heightAttr: number
  heightIsAuto: boolean
  naturalHeightPx: number | null
  isMultiView: boolean
}): ChartLayout => {
  const { heightAttr, heightIsAuto, naturalHeightPx, isMultiView } = args
  if (!isMultiView || !naturalHeightPx || naturalHeightPx <= 0) {
    return { boxHeightPx: heightAttr, scale: 1 }
  }
  const target = heightIsAuto ? naturalHeightPx : heightAttr
  // Cap at 1: shrinking scales the chart down; growing past natural size just adds space below
  // rather than magnifying (which would blur text and force horizontal scrolling).
  return { boxHeightPx: target, scale: Math.min(1, target / naturalHeightPx) }
}

/** Content width (px) a chart gets on a small phone in portrait: roughly the smallest breakpoint
 * (xxs = 400px) minus the course-material content padding (2 × 1.375rem ≈ 44px). Kept as a literal
 * rather than derived from the breakpoint constants, since those are viewport thresholds and this
 * is a content width. A chart rendered wider than this forces students on mobile to scroll
 * sideways to see all of it. */
export const MOBILE_CONTENT_WIDTH_PX = 360

/**
 * Whether the chart will be wider than a small phone's screen and force horizontal scrolling on
 * mobile. Only multi-view specs can: single-view specs are refit to the viewport width, so they
 * always fit regardless of viewport. `naturalWidthPx` is the chart's unscaled rendered width;
 * `scale` is the CSS scale applied for height fitting (see resolveChartLayout).
 */
export const wouldSideScrollOnMobile = (args: {
  isMultiView: boolean
  naturalWidthPx: number | null
  scale: number
}): boolean => {
  const { isMultiView, naturalWidthPx, scale } = args
  if (!isMultiView || !naturalWidthPx || naturalWidthPx <= 0) {
    return false
  }
  return naturalWidthPx * scale > MOBILE_CONTENT_WIDTH_PX
}

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
  const path = (url.split("?")[0] ?? "").toLowerCase()
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

/**
 * Spec with its `data` pointed at the given URL. An empty spec yields a minimal starter spec so a
 * data file can be attached first; null if a non-empty spec isn't valid JSON.
 */
export const specWithDataUrl = (
  specString: string,
  url: string,
): Record<string, unknown> | null => {
  const format = dataFormatForUrl(url)
  const data = { url, ...(format ? { format } : {}) }
  if (specString.trim() === "") {
    return { $schema: VEGA_LITE_SCHEMA_URL, data }
  }
  let parsed: Record<string, unknown>
  try {
    parsed = JSON.parse(specString)
  } catch {
    return null
  }
  return { ...parsed, data }
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
