"use client"

import { css } from "@emotion/css"
import React from "react"
import { VegaLite } from "react-vega"

import { useDebouncedElementWidth } from "@/hooks/useDebouncedElementWidth"
import { useFontLoaded } from "@/hooks/useFontLoaded"
import { baseTheme, primaryFont } from "@/shared-module/common/styles"
import { useTranslation } from "@/utils/useCmsTranslation"

import { wouldSideScrollOnMobile } from "./chartSpec"
import { useChartNaturalSize } from "./useChartNaturalSize"
import { useRenderableChartSpec } from "./useRenderableChartSpec"

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
  heightIsAuto: boolean
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
  // Vega measures text on a canvas to lay the chart out, so it must not draw before the site font
  // has loaded.
  const siteFontLoaded = useFontLoaded()
  const { ref: containerRef, width } = useDebouncedElementWidth<HTMLElement>(RESIZE_DEBOUNCE_MS)
  const { chartRef, naturalHeightPx, naturalWidthPx } = useChartNaturalSize({
    debounceMs: RESIZE_DEBOUNCE_MS,
    onHeightChange: onNaturalHeightChange,
  })

  const { isValidJson, hasData, isMultiView, responsiveSpec, boxHeightPx, scale } =
    useRenderableChartSpec({
      spec,
      containerWidthPx: width,
      heightPx: height,
      heightIsAuto,
      naturalHeightPx,
      caption,
    })

  const willSideScrollOnMobile =
    Boolean(warnOnMobileOverflow) && wouldSideScrollOnMobile({ isMultiView, naturalWidthPx, scale })

  return (
    <figure
      ref={containerRef}
      className={css`
        margin: 0;
      `}
    >
      {!isValidJson && (
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
      {isValidJson && !hasData && (
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
            {siteFontLoaded && <VegaLite spec={responsiveSpec} actions={false} renderer="svg" />}
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
