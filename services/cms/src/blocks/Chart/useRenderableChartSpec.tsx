"use client"

import React, { useMemo } from "react"
import type { VegaLite } from "react-vega"

import { primaryFont } from "@/shared-module/common/styles"

import { isMultiViewSpec, resolveChartLayout, specHasData } from "./chartSpec"

/** The spec object the renderer accepts, taken from react-vega so it cannot drift from it. */
export type VegaLiteSpec = React.ComponentProps<typeof VegaLite>["spec"]

interface ParsedChartSpec {
  description?: unknown
  config?: Record<string, unknown>
  [key: string]: unknown
}

interface RenderableChartSpecOptions {
  /** The stored Vega-Lite specification, as the teacher wrote it. */
  spec: string
  /** Width available to the chart; null until the container has been measured. */
  containerWidthPx: number | null
  /** Height the block is set to. */
  heightPx: number
  heightIsAuto: boolean
  /** The height the chart renders at on its own, from `useChartNaturalSize`. */
  naturalHeightPx: number | null
  /** Used as the chart's accessible name when the spec has no `description` of its own. */
  caption?: string | undefined
}

interface RenderableChartSpec {
  /** False when the spec isn't parseable JSON, so there is nothing to draw at all. */
  isValidJson: boolean
  /** Whether the spec names a data source anywhere; a chart without one cannot be drawn. */
  hasData: boolean
  isMultiView: boolean
  /** The spec to hand to the renderer; null until both the spec and the width are known. */
  responsiveSpec: VegaLiteSpec | null
  /** Height of the box the chart is drawn in. */
  boxHeightPx: number
  /** CSS scale that fits a multi-view chart into that box; always 1 for single-view specs. */
  scale: number
}

const parseSpec = (specString: string): ParsedChartSpec | null => {
  try {
    const parsed: unknown = JSON.parse(specString)
    return parsed ? (parsed as ParsedChartSpec) : null
  } catch {
    return null
  }
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
    heightAttr: heightPx,
    heightIsAuto,
    naturalHeightPx,
    isMultiView,
  })

  return {
    isValidJson: parsedSpec !== null,
    hasData,
    isMultiView,
    responsiveSpec,
    boxHeightPx,
    scale,
  }
}
