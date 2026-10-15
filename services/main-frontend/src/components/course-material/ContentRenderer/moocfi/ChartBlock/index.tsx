"use client"

import { css } from "@emotion/css"
import React from "react"
import { useTranslation } from "react-i18next"
import { VegaLite } from "react-vega"

import { useDebouncedElementWidth } from "@/shared-module/common/hooks/useDebouncedElementWidth"
import { useFontLoaded } from "@/shared-module/common/hooks/useFontLoaded"
import { baseTheme, primaryFont } from "@/shared-module/common/styles"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"

import type { BlockRendererProps } from "../.."
import { useChartNaturalHeight } from "./useChartNaturalHeight"
import { useRenderableChartSpec } from "./useRenderableChartSpec"

interface ChartBlockAttributes {
  spec: string
  caption: string
  /** Chart height in pixels; width is responsive. */
  height: number
  /** Whether `height` is still the automatic size rather than one the teacher picked. */
  heightIsAuto: boolean
}

const MIN_HEIGHT = 200
// Debounce redraws to once the resize settles, not per tick (avoids a stale canvas width).
const RESIZE_DEBOUNCE_MS = 150

const ChartBlock: React.FC<React.PropsWithChildren<BlockRendererProps<ChartBlockAttributes>>> = (
  props,
) => {
  const { t } = useTranslation()
  const { spec, caption, height, heightIsAuto } = props.data.attributes
  // Vega measures text on a canvas to lay the chart out, so it must not draw before the site font
  // has loaded.
  const siteFontLoaded = useFontLoaded()
  const { ref: containerRef, width } = useDebouncedElementWidth<HTMLElement>(RESIZE_DEBOUNCE_MS)
  const { chartRef, naturalHeightPx } = useChartNaturalHeight(RESIZE_DEBOUNCE_MS)

  const { isValidJson, hasData, responsiveSpec, boxHeightPx, scale } = useRenderableChartSpec({
    spec,
    containerWidthPx: width,
    heightPx: height,
    heightIsAuto,
    naturalHeightPx,
    caption,
  })

  return (
    <figure
      ref={containerRef}
      className={css`
        margin: 0;
      `}
    >
      {!isValidJson && (
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
            {siteFontLoaded && <VegaLite spec={responsiveSpec} actions={false} renderer="svg" />}
          </div>
        </div>
      )}
      {isValidJson && !hasData && (
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
