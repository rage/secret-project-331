import { logger, None, parse } from "vega"
import { compile, type TopLevelSpec } from "vega-lite"

import { specDefinesView } from "./chartSpec"

export interface ChartSpecValidity {
  ok: boolean
  /** The renderer's error message when the spec can't render; undefined when it can. */
  error?: string
}

// Vega-Lite logs compile warnings to the console by default; swallow them during validation.
const silentLogger = logger(None)

/**
 * Whether a Vega-Lite spec will actually render. A spec can pass Vega-Lite JSON-schema validation
 * yet still fail when Vega builds the runtime (e.g. duplicate signals from a top-level selection in
 * a multi-view spec). This runs the same two steps the renderer does — Vega-Lite compile, then Vega
 * parse — and returns the first error, so callers can catch unrenderable specs before showing them.
 */
export const validateChartSpec = (parsedSpec: object): ChartSpecValidity => {
  try {
    const { spec } = compile(parsedSpec as TopLevelSpec, { logger: silentLogger })
    parse(spec)
    return { ok: true }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) }
  }
}

/**
 * Why a spec string won't render, or null if it renders — or isn't a complete view yet, which a
 * freshly data-attached spec is not. Covers both malformed JSON and JSON that parses but fails the
 * same compile the renderer does.
 */
export const renderErrorForSpec = (specString: string): string | null => {
  let parsed: unknown
  try {
    parsed = JSON.parse(specString)
  } catch (error) {
    return error instanceof Error ? error.message : String(error)
  }
  if (!specDefinesView(parsed)) {
    return null
  }
  const result = validateChartSpec(parsed as object)
  return result.ok ? null : (result.error ?? null)
}
