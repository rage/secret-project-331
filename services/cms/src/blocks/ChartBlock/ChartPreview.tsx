"use client"

import { css } from "@emotion/css"
import React, { useEffect, useRef, useState } from "react"
import { VegaLite } from "react-vega"

import { baseTheme, primaryFont } from "@/shared-module/common/styles"
import { useTranslation } from "@/utils/useCmsTranslation"

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

interface ChartPreviewProps {
  spec: string
  height: number
  caption?: string
}

const ChartPreview: React.FC<ChartPreviewProps> = ({ spec, height, caption }) => {
  const { t } = useTranslation()
  const containerRef = useRef<HTMLDivElement>(null)
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
  const accessibleDescription = parsedSpec?.description ?? (caption?.trim() ? caption : undefined)

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
    <div ref={containerRef}>
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
            overflow-x: auto;
            width: 100%;
          `}
        >
          <VegaLite spec={responsiveSpec} actions={false} />
        </div>
      )}
    </div>
  )
}

export default ChartPreview
