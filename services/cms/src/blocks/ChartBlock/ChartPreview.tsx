"use client"

import { css } from "@emotion/css"
import React, { useCallback, useEffect, useRef, useState } from "react"
import { VegaLite } from "react-vega"

import { baseTheme, primaryFont } from "@/shared-module/common/styles"
import { useTranslation } from "@/utils/useCmsTranslation"

import {
  isAutoHeight,
  isMultiViewSpec,
  resolveChartLayout,
  specHasData,
  wouldSideScrollOnMobile,
} from "./chartSpec"

const MIN_HEIGHT = 200
// Debounce redraws to once the resize settles, not per tick (avoids a stale canvas width).
const RESIZE_DEBOUNCE_MS = 150

const messageStyle = (background: string, border: string, color: string) => css`
  padding: 1rem;
  background: ${background};
  border: 1px solid ${border};
  border-radius: 4px;
  font-family: ${primaryFont};
  font-size: 0.875rem;
  color: ${color};
  min-height: ${MIN_HEIGHT}px;
  display: flex;
  align-items: center;
`

export const chartCaptionStyle = css`
  margin: 0.5rem 0 0;
  font-family: ${primaryFont};
  font-size: 0.875rem;
  color: ${baseTheme.colors.gray[600]};
  text-align: center;
`

interface ChartPreviewProps {
  spec: string
  height: number
  heightIsAuto?: boolean | undefined
  caption?: string
  showCaption?: boolean
  /** Reports the chart's natural (unscaled) rendered height so a caller can size its box to match.
   * Multi-view (concat/facet/repeat) specs ignore the injected height and render at their natural
   * size, so this is the only reliable way to know how tall the chart really is. */
  onNaturalHeightChange?: (heightPx: number) => void
  /** Show a warning below the chart when it will overflow a phone's width and force students to
   * scroll sideways on mobile. Off by default; the authoring modal opts in. */
  warnOnMobileOverflow?: boolean
}

const ChartPreview: React.FC<ChartPreviewProps> = ({
  spec,
  height,
  heightIsAuto,
  caption,
  showCaption,
  onNaturalHeightChange,
  warnOnMobileOverflow,
}) => {
  const { t } = useTranslation()
  const containerRef = useRef<HTMLElement>(null)
  const [width, setWidth] = useState<number | null>(null)
  const [naturalHeight, setNaturalHeight] = useState<number | null>(null)
  const [naturalWidth, setNaturalWidth] = useState<number | null>(null)

  const lastReportedHeightRef = useRef<number | null>(null)
  const lastReportedWidthRef = useRef<number | null>(null)
  const chartObserverRef = useRef<ResizeObserver | undefined>(undefined)
  const heightDebounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  const report = useCallback(
    (node: HTMLDivElement) => {
      // offsetHeight is the layout height, unaffected by the CSS scale we apply for resizing, so
      // it always reflects the chart's true natural height.
      const measuredHeight = node.offsetHeight
      if (measuredHeight > 0 && measuredHeight !== lastReportedHeightRef.current) {
        lastReportedHeightRef.current = measuredHeight
        setNaturalHeight(measuredHeight)
        onNaturalHeightChange?.(measuredHeight)
      }
      // The SVG's own layout width, likewise unaffected by the scale — the chart's true width. For
      // multi-view specs this is intrinsic (not the container's), so it predicts the width the
      // chart takes on any viewport, letting us warn about side-scrolling on a narrow phone.
      const measuredWidth = node.querySelector("svg")?.clientWidth ?? 0
      if (measuredWidth > 0 && measuredWidth !== lastReportedWidthRef.current) {
        lastReportedWidthRef.current = measuredWidth
        setNaturalWidth(measuredWidth)
      }
    },
    [onNaturalHeightChange],
  )

  // Callback ref: (re)attach a ResizeObserver as the chart node mounts/unmounts. Vega renders
  // asynchronously (and again when the remote data loads), so we watch for size changes rather
  // than measuring once.
  const chartRef = useCallback(
    (node: HTMLDivElement | null) => {
      chartObserverRef.current?.disconnect()
      if (!node) {
        return
      }
      const observer = new ResizeObserver(() => {
        if (heightDebounceRef.current) {
          clearTimeout(heightDebounceRef.current)
        }
        heightDebounceRef.current = setTimeout(() => report(node), RESIZE_DEBOUNCE_MS)
      })
      observer.observe(node)
      chartObserverRef.current = observer
      report(node)
    },
    [report],
  )

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

  const hasData = specHasData(parsedSpec)
  const multiView = isMultiViewSpec(parsedSpec)

  // Vega uses `description` as the chart's accessible name; fall back to the caption.
  const accessibleDescription = parsedSpec?.description ?? caption

  const responsiveSpec =
    parsedSpec && width !== null
      ? {
          ...parsedSpec,
          ...(accessibleDescription ? { description: accessibleDescription } : {}),
          width,
          // Single/layered views size themselves to the box via autosize "fit"; multi-view specs
          // ignore both, so we leave them at natural size and scale with CSS below instead.
          ...(multiView
            ? {}
            : // eslint-disable-next-line i18next/no-literal-string
              { height, autosize: { type: "fit", contains: "padding" } }),
        }
      : null

  const { boxHeightPx, scale } = resolveChartLayout({
    heightAttr: height,
    heightIsAuto: isAutoHeight(height, heightIsAuto),
    naturalHeightPx: naturalHeight,
    isMultiView: multiView,
  })

  const willSideScrollOnMobile =
    Boolean(warnOnMobileOverflow) &&
    wouldSideScrollOnMobile({ isMultiView: multiView, naturalWidthPx: naturalWidth, scale })

  return (
    <figure
      ref={containerRef}
      className={css`
        margin: 0;
      `}
    >
      {!parsedSpec && (
        <div
          className={messageStyle(
            baseTheme.colors.red[100],
            baseTheme.colors.red[400],
            baseTheme.colors.red[700],
          )}
        >
          {t("chart-block-invalid-spec-error")}
        </div>
      )}
      {parsedSpec && !hasData && (
        <div
          className={messageStyle(
            baseTheme.colors.gray[100],
            baseTheme.colors.gray[400],
            baseTheme.colors.gray[700],
          )}
        >
          {t("chart-block-no-data-file")}
        </div>
      )}
      {responsiveSpec && hasData && (
        <div
          className={css`
            /* The box the resizable edge controls. Height is explicit so the scaled chart below
               reserves the right space; overflow-y clips the untransformed layout overflow that a
               scaled-down chart leaves behind, overflow-x keeps a scrollbar for over-wide charts. */
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
            {/* eslint-disable-next-line i18next/no-literal-string */}
            <VegaLite spec={responsiveSpec} actions={false} renderer="svg" />
          </div>
        </div>
      )}
      {showCaption && caption?.trim() && (
        <figcaption className={chartCaptionStyle}>{caption}</figcaption>
      )}
      {willSideScrollOnMobile && (
        <p
          className={css`
            margin: 0.75rem 0 0;
            padding: 0.75rem 1rem;
            background: ${baseTheme.colors.yellow[100]};
            border: 1px solid ${baseTheme.colors.yellow[300]};
            border-radius: 4px;
            font-family: ${primaryFont};
            font-size: 0.8125rem;
            color: ${baseTheme.colors.gray[700]};
          `}
        >
          {t("chart-block-mobile-scroll-warning")}
        </p>
      )}
    </figure>
  )
}

export default ChartPreview
