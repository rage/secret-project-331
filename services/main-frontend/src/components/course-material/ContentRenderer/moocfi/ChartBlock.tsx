"use client"

import { css } from "@emotion/css"
import React, { useCallback, useEffect, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { VegaLite } from "react-vega"

import { baseTheme, primaryFont } from "@/shared-module/common/styles"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"

import type { BlockRendererProps } from ".."

interface ChartBlockAttributes {
  spec: string
  caption: string
  /** Chart height in pixels; width is responsive. */
  height: number
}

const MIN_HEIGHT = 200
// Debounce redraws to once the resize settles, not per tick (avoids a stale canvas width).
const RESIZE_DEBOUNCE_MS = 150

// Mirrors the cms block's chartSpec.ts so the published chart matches the editor's sizing.
const DEFAULT_CHART_HEIGHT = 300
const MULTI_VIEW_KEYS = ["vconcat", "hconcat", "concat", "facet", "repeat"] as const

// Multi-view specs ignore a top-level height, so they render at natural size and are scaled to the
// saved height with CSS instead.
const isMultiViewSpec = (parsed: unknown): boolean =>
  typeof parsed === "object" &&
  parsed !== null &&
  MULTI_VIEW_KEYS.some((key) => key in (parsed as Record<string, unknown>))

const resolveChartLayout = (args: {
  heightAttr: number
  naturalHeightPx: number | null
  isMultiView: boolean
}): { boxHeightPx: number; scale: number } => {
  const { heightAttr, naturalHeightPx, isMultiView } = args
  if (!isMultiView || !naturalHeightPx || naturalHeightPx <= 0) {
    return { boxHeightPx: heightAttr, scale: 1 }
  }
  const target = heightAttr === DEFAULT_CHART_HEIGHT ? naturalHeightPx : heightAttr
  return { boxHeightPx: target, scale: Math.min(1, target / naturalHeightPx) }
}

const ChartBlock: React.FC<React.PropsWithChildren<BlockRendererProps<ChartBlockAttributes>>> = (
  props,
) => {
  const { t } = useTranslation()
  const { spec, caption, height } = props.data.attributes
  const containerRef = useRef<HTMLElement>(null)
  const [width, setWidth] = useState<number | null>(null)
  const [naturalHeight, setNaturalHeight] = useState<number | null>(null)

  const lastReportedHeightRef = useRef<number | null>(null)
  const chartObserverRef = useRef<ResizeObserver | undefined>(undefined)
  const heightDebounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  // Callback ref: watch the chart's natural (unscaled) layout height. offsetHeight ignores the CSS
  // scale applied for sizing, so it always reflects the chart's true height.
  const chartRef = useCallback((node: HTMLDivElement | null) => {
    chartObserverRef.current?.disconnect()
    if (!node) {
      return
    }
    const report = () => {
      const measured = node.offsetHeight
      if (measured > 0 && measured !== lastReportedHeightRef.current) {
        lastReportedHeightRef.current = measured
        setNaturalHeight(measured)
      }
    }
    const observer = new ResizeObserver(() => {
      if (heightDebounceRef.current) {
        clearTimeout(heightDebounceRef.current)
      }
      heightDebounceRef.current = setTimeout(report, RESIZE_DEBOUNCE_MS)
    })
    observer.observe(node)
    chartObserverRef.current = observer
    report()
  }, [])

  useEffect(
    () => () => {
      chartObserverRef.current?.disconnect()
      if (heightDebounceRef.current) {
        clearTimeout(heightDebounceRef.current)
      }
    },
    [],
  )

  useEffect(() => {
    const el = containerRef.current
    if (!el) {
      return
    }
    let timeout: ReturnType<typeof setTimeout> | undefined
    const measure = () => setWidth(Math.floor(el.getBoundingClientRect().width))
    const observer = new ResizeObserver(() => {
      if (timeout) {
        clearTimeout(timeout)
      }
      timeout = setTimeout(measure, RESIZE_DEBOUNCE_MS)
    })
    observer.observe(el)
    measure()
    return () => {
      observer.disconnect()
      if (timeout) {
        clearTimeout(timeout)
      }
    }
  }, [])

  const parsedSpec = (() => {
    try {
      return JSON.parse(spec)
    } catch {
      return null
    }
  })()

  const hasData = Boolean(parsedSpec?.data)
  const multiView = isMultiViewSpec(parsedSpec)

  // Vega uses `description` as the chart's accessible name; fall back to the caption.
  const accessibleDescription = parsedSpec?.description ?? caption

  const responsiveSpec =
    parsedSpec && width !== null
      ? {
          ...parsedSpec,
          ...(accessibleDescription ? { description: accessibleDescription } : {}),
          width,
          // Single/layered views fit the box via autosize; multi-view specs ignore it and are
          // scaled with CSS below.
          ...(multiView
            ? {}
            : // eslint-disable-next-line i18next/no-literal-string
              { height, autosize: { type: "fit", contains: "padding" } }),
        }
      : null

  const { boxHeightPx, scale } = resolveChartLayout({
    heightAttr: height,
    naturalHeightPx: naturalHeight,
    isMultiView: multiView,
  })

  return (
    <figure
      ref={containerRef}
      className={css`
        margin: 0;
      `}
    >
      {!parsedSpec && (
        <div
          className={css`
            padding: 1rem;
            background: ${baseTheme.colors.red[100]};
            border: 1px solid ${baseTheme.colors.red[400]};
            border-radius: 4px;
            font-family: ${primaryFont};
            font-size: 0.875rem;
            color: ${baseTheme.colors.red[700]};
            min-height: ${MIN_HEIGHT}px;
            display: flex;
            align-items: center;
          `}
        >
          {t("chart-block-invalid-spec-error")}
        </div>
      )}
      {responsiveSpec && hasData && (
        <div
          className={css`
            /* The chart's box: explicit height so the scaled chart reserves the right space.
               overflow-y clips the untransformed layout overflow a scaled-down chart leaves;
               overflow-x keeps a scrollbar for over-wide charts. */
            width: 100%;
            height: ${boxHeightPx}px;
            overflow-x: auto;
            overflow-y: hidden;
          `}
        >
          <div
            ref={chartRef}
            className={css`
              width: 100%;
              transform: scale(${scale});
              transform-origin: top left;
            `}
          >
            {/* SVG so Vega emits per-axis/mark ARIA. */}
            {/* eslint-disable-next-line i18next/no-literal-string */}
            <VegaLite spec={responsiveSpec} actions={false} renderer="svg" />
          </div>
        </div>
      )}
      {parsedSpec && !hasData && (
        <div
          className={css`
            padding: 1rem;
            background: ${baseTheme.colors.gray[100]};
            border: 1px solid ${baseTheme.colors.gray[400]};
            border-radius: 4px;
            font-family: ${primaryFont};
            font-size: 0.875rem;
            color: ${baseTheme.colors.gray[700]};
            min-height: ${MIN_HEIGHT}px;
            display: flex;
            align-items: center;
          `}
        >
          {t("chart-block-no-data-file")}
        </div>
      )}
      {caption && (
        <figcaption
          className={css`
            margin: 0.5rem 0 0;
            font-family: ${primaryFont};
            font-size: 0.875rem;
            color: ${baseTheme.colors.gray[600]};
            text-align: center;
          `}
        >
          {caption}
        </figcaption>
      )}
    </figure>
  )
}

export default withErrorBoundary(ChartBlock)
