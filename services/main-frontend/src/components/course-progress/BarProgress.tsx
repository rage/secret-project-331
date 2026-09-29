"use client"

import { css, cx } from "@emotion/css"
import { useRef } from "react"
import { mergeProps, useProgressBar } from "react-aria"

import { secondaryFont } from "@/shared-module/common/styles"
import { respondToOrLarger } from "@/shared-module/common/styles/respond"

import { barFillWidth } from "./chartGeometry"
import type { ProgressChartProps } from "./chartProps"
import { ChartTooltip, useChartTooltip } from "./ChartTooltip"
import { toRatio } from "./progressText"
import { chartFocusCss, growWidth, progressColors, reducedMotion } from "./progressTheme"

/** Exercises bar with a labelled vertical tick at `required`; the bar is the progressbar. */
const BarProgress: React.FC<ProgressChartProps> = ({
  value,
  max,
  required,
  tickLabel,
  valueText,
  tooltipLines,
  labelledBy,
}) => {
  const ref = useRef<HTMLDivElement>(null)
  const { triggerProps, tooltip } = useChartTooltip(ref)
  const { progressBarProps } = useProgressBar({
    value,
    minValue: 0,
    maxValue: max,
    valueLabel: valueText,
    "aria-labelledby": labelledBy,
  })
  const valueRatio = toRatio(value, max)
  const requiredRatio = required === null ? null : toRatio(required, max)

  return (
    <>
      <div
        {...mergeProps(progressBarProps, triggerProps)}
        ref={ref}
        className={cx(rootCss, chartFocusCss, requiredRatio !== null && withTickCss)}
      >
        <div className={laneCss}>
          <div className={trackCss}>
            {valueRatio > 0 && (
              <div
                data-part="fill"
                className={cx(
                  fillCss,
                  css`
                    width: ${barFillWidth(valueRatio, requiredRatio)};
                  `,
                )}
              />
            )}
          </div>
          {requiredRatio !== null && (
            <span
              data-part="tick"
              aria-hidden="true"
              className={cx(
                tickCss,
                css`
                  inset-inline-start: ${requiredRatio * 100}%;
                `,
              )}
            >
              <span className={tickLabelCss}>
                <bdi>{tickLabel}</bdi>
              </span>
            </span>
          )}
        </div>
      </div>
      <ChartTooltip {...tooltip} lines={tooltipLines} />
    </>
  )
}

export default BarProgress

const rootCss = css`
  position: relative;
  padding-block: 0.25rem 1rem;
`

const withTickCss = css`
  padding-block-start: 1.75rem;
`

const laneCss = css`
  position: relative;
`

const trackCss = css`
  --bar-height: 1.25rem;
  display: flex;
  height: var(--bar-height);
  border-radius: 999px;
  background: ${progressColors.track};
  overflow: hidden;

  ${respondToOrLarger.sm} {
    --bar-height: 1.5rem;
  }

  @media (forced-colors: active) {
    background: Canvas;
    border: 1px solid CanvasText;
  }
`

const fillCss = css`
  height: 100%;
  min-width: var(--bar-height);
  border-radius: 999px;
  background: ${progressColors.fill};
  animation: ${growWidth} 0.9s ease-out;

  ${reducedMotion} {
    animation: none;
  }

  @media (forced-colors: active) {
    background: SelectedItem;
  }
`

const tickCss = css`
  position: absolute;
  top: -0.4rem;
  bottom: -0.4rem;
  width: 4px;
  margin-inline-start: -2px;
  border-radius: 2px;
  background: ${progressColors.tick};
  box-shadow: 0 0 0 1px ${progressColors.panel};

  @media (forced-colors: active) {
    background: CanvasText;
    box-shadow: 0 0 0 1px Canvas;
  }
`

// Centred on the tick, so the physical offset is right in RTL too.
const tickLabelCss = css`
  position: absolute;
  bottom: 100%;
  left: 50%;
  transform: translateX(-50%);
  padding-bottom: 0.3rem;
  font: 600 0.85rem ${secondaryFont};
  color: ${progressColors.tick};
  white-space: nowrap;

  @media (forced-colors: active) {
    color: CanvasText;
  }
`
