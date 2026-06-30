"use client"

import { css } from "@emotion/css"
import React, { useEffect, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { VegaLite } from "react-vega"

import { BlockRendererProps } from ".."

import { baseTheme, primaryFont } from "@/shared-module/common/styles"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"

interface ChartBlockAttributes {
  spec: string
  caption: string
  data: File
}

const MIN_HEIGHT = 200
// Debounce so we redraw once resizing settles; redrawing per tick races Vega's canvas sizing and sticks at a stale width.
const RESIZE_DEBOUNCE_MS = 150

const ChartBlock: React.FC<React.PropsWithChildren<BlockRendererProps<ChartBlockAttributes>>> = (
  props,
) => {
  const { t } = useTranslation()
  const { spec, caption } = props.data.attributes
  const containerRef = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState<number | null>(null)
  const [data, setData] = useState<File> | (null > null)

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

  const responsiveSpec =
    parsedSpec && width !== null
      ? {
          ...parsedSpec,
          width,
          // eslint-disable-next-line i18next/no-literal-string
          autosize: { type: "fit", contains: "padding" },
        }
      : null

  return (
    <div ref={containerRef}>
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
      {responsiveSpec && (
        <div
          className={css`
            overflow-x: auto;
            width: 100%;
          `}
        >
          <VegaLite spec={responsiveSpec} actions={false} />
        </div>
      )}
      {data && (
        <div>
          <p>{t("chart-block-data-file-info")}</p>
        </div>
      )}
      {caption && (
        <p
          className={css`
            margin: 0.5rem 0 0;
            font-family: ${primaryFont};
            font-size: 0.875rem;
            color: ${baseTheme.colors.gray[600]};
            text-align: center;
          `}
        >
          {caption}
        </p>
      )}
    </div>
  )
}

export default withErrorBoundary(ChartBlock)
