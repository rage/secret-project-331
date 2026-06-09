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
}

const MIN_HEIGHT = 200

const ChartBlock: React.FC<React.PropsWithChildren<BlockRendererProps<ChartBlockAttributes>>> = (
  props,
) => {
  const { t } = useTranslation()
  const { spec, caption } = props.data.attributes
  const containerRef = useRef<HTMLDivElement>(null)
  const [containerWidth, setContainerWidth] = useState<number | null>(null)

  useEffect(() => {
    const el = containerRef.current
    if (!el) {
      return
    }
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (entry) {
        setContainerWidth(Math.floor(entry.contentRect.width))
      }
    })
    observer.observe(el)
    setContainerWidth(Math.floor(el.getBoundingClientRect().width))
    return () => observer.disconnect()
  }, [])

  const parsedSpec = (() => {
    try {
      return JSON.parse(spec)
    } catch {
      return null
    }
  })()

  const responsiveSpec = parsedSpec
    ? {
        ...parsedSpec,
        // Override width to fill the container; keep height proportional unless already set
        width: containerWidth !== null ? containerWidth - 40 : (parsedSpec.width ?? 400),
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
      {responsiveSpec && containerWidth !== null && (
        <div
          className={css`
            overflow-x: auto;
            width: 100%;
          `}
        >
          <VegaLite spec={responsiveSpec} actions={false} />
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
