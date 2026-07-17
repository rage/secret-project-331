"use client"

import { css } from "@emotion/css"
import React, { useEffect, useRef, useState } from "react"
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

const ChartBlock: React.FC<React.PropsWithChildren<BlockRendererProps<ChartBlockAttributes>>> = (
  props,
) => {
  const { t } = useTranslation()
  const { spec, caption, height } = props.data.attributes
  const containerRef = useRef<HTMLElement>(null)
  const [width, setWidth] = useState<number | null>(null)

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

  // Vega uses `description` as the chart's accessible name; fall back to the caption.
  const accessibleDescription = parsedSpec?.description ?? caption

  const responsiveSpec =
    parsedSpec && width !== null
      ? {
          ...parsedSpec,
          ...(accessibleDescription ? { description: accessibleDescription } : {}),
          width,
          height,
          // eslint-disable-next-line i18next/no-literal-string
          autosize: { type: "fit", contains: "padding" },
        }
      : null

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
            overflow-x: auto;
            width: 100%;
          `}
        >
          {/* SVG so Vega emits per-axis/mark ARIA. */}
          {/* eslint-disable-next-line i18next/no-literal-string */}
          <VegaLite spec={responsiveSpec} actions={false} renderer="svg" />
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
