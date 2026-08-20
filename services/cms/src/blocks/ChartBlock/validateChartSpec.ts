import { logger, None, parse } from "vega"
import { compile, type TopLevelSpec } from "vega-lite"

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
