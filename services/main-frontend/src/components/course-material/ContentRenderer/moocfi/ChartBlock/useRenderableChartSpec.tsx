"use client"

import React, { useMemo } from "react"
import type { VegaLite } from "react-vega"

import { primaryFont } from "@/shared-module/common/styles"

/** The spec object the renderer accepts, taken from react-vega so it cannot drift from it. */
export type VegaLiteSpec = React.ComponentProps<typeof VegaLite>["spec"]

// These mirror the cms block's chartSpec.ts, so a published chart matches the editor's preview.

const MULTI_VIEW_KEYS = ["vconcat", "hconcat", "concat", "facet", "repeat"] as const

// Vega-Lite ignores a top-level height on a multi-view spec, so such charts can't be sized through
// the spec; they render at natural size and are scaled with CSS instead.
const isMultiViewSpec = (parsed: unknown): boolean =>
  typeof parsed === "object" &&
  parsed !== null &&
  MULTI_VIEW_KEYS.some((key) => key in (parsed as Record<string, unknown>))

// Keys whose values are themselves view specifications, each of which may carry its own data.
const SUB_SPEC_KEYS = ["layer", "hconcat", "vconcat", "concat", "spec"] as const

// Vega-Lite allows `data` on any view, not just the top level: a layered or concatenated chart
// whose views come from different files has none there at all.
const specHasData = (parsed: unknown): boolean => {
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

// Multi-view specs render at their natural height; they are scaled uniformly to the requested
// height, or shown at full natural size while `heightIsAuto` says the teacher hasn't chosen one.
// Scaling up is capped at 1, since magnifying a chart only blurs its text.
const resolveChartLayout = (args: {
  heightPx: number
  heightIsAuto: boolean
  naturalHeightPx: number | null
  isMultiView: boolean
}): { boxHeightPx: number; scale: number } => {
  const { heightPx, heightIsAuto, naturalHeightPx, isMultiView } = args
  if (!isMultiView || !naturalHeightPx || naturalHeightPx <= 0) {
    return { boxHeightPx: heightPx, scale: 1 }
  }
  const target = heightIsAuto ? naturalHeightPx : heightPx
  return { boxHeightPx: target, scale: Math.min(1, target / naturalHeightPx) }
}

interface ParsedChartSpec {
  description?: unknown
  config?: Record<string, unknown>
  [key: string]: unknown
}

const parseSpec = (specString: string): ParsedChartSpec | null => {
  try {
    const parsed: unknown = JSON.parse(specString)
    return parsed ? (parsed as ParsedChartSpec) : null
  } catch {
    return null
  }
}

interface RenderableChartSpecOptions {
  /** The stored Vega-Lite specification, as the teacher wrote it. */
  spec: string
  /** Width available to the chart; null until the container has been measured. */
  containerWidthPx: number | null
  /** Height the block is set to. */
  heightPx: number
  /** Whether that height is still the automatic one rather than one the teacher picked. */
  heightIsAuto: boolean
  /** The height the chart renders at on its own, from `useChartNaturalHeight`. */
  naturalHeightPx: number | null
  /** Used as the chart's accessible name when the spec has no `description` of its own. */
  caption?: string
}

interface RenderableChartSpec {
  /** False when the spec isn't parseable JSON, so there is nothing to draw at all. */
  isValidJson: boolean
  /** Whether the spec names a data source anywhere; a chart without one cannot be drawn. */
  hasData: boolean
  /** The spec to hand to the renderer; null until both the spec and the width are known. */
  responsiveSpec: VegaLiteSpec | null
  /** Height of the box the chart is drawn in. */
  boxHeightPx: number
  /** CSS scale that fits a multi-view chart into that box; always 1 for single-view specs. */
  scale: number
}

/**
 * Turns the stored specification into what the renderer needs: the spec sized to the measured
 * width, and the box height and scale to draw it at.
 *
 * Single-view specs are refit to the box by Vega-Lite itself, so they get an explicit height and
 * autosize. Multi-view (concat/facet/repeat) specs ignore both, so they are left at their natural
 * size and the caller scales them with CSS instead.
 */
export const useRenderableChartSpec = ({
  spec,
  containerWidthPx,
  heightPx,
  heightIsAuto,
  naturalHeightPx,
  caption,
}: RenderableChartSpecOptions): RenderableChartSpec => {
  const parsedSpec = useMemo(() => parseSpec(spec), [spec])
  const hasData = useMemo(() => specHasData(parsedSpec), [parsedSpec])
  const isMultiView = useMemo(() => isMultiViewSpec(parsedSpec), [parsedSpec])

  const responsiveSpec = useMemo(() => {
    if (!parsedSpec || containerWidthPx === null) {
      return null
    }
    // Vega uses `description` as the chart's accessible name; fall back to the caption.
    const accessibleDescription = parsedSpec.description ?? caption
    return {
      ...parsedSpec,
      ...(accessibleDescription ? { description: accessibleDescription } : {}),
      width: containerWidthPx,
      // The chart's text in the site font instead of Vega's default sans-serif, so it reads as part
      // of the page. A spec that sets its own config keeps it.
      config: { font: primaryFont, ...parsedSpec.config },
      ...(isMultiView
        ? {}
        : // eslint-disable-next-line i18next/no-literal-string
          { height: heightPx, autosize: { type: "fit", contains: "padding" } }),
    } as VegaLiteSpec
  }, [parsedSpec, containerWidthPx, caption, isMultiView, heightPx])

  const { boxHeightPx, scale } = resolveChartLayout({
    heightPx,
    heightIsAuto,
    naturalHeightPx,
    isMultiView,
  })

  return { isValidJson: parsedSpec !== null, hasData, responsiveSpec, boxHeightPx, scale }
}
