"use client"

import { css, cx } from "@emotion/css"
import { useRef } from "react"
import { mergeProps, useProgressBar } from "react-aria"

import { headingFont, secondaryFont } from "@/shared-module/common/styles"
import { respondToOrLarger } from "@/shared-module/common/styles/respond"

import { DONUT, donutFill } from "./chartGeometry"
import type { ChartSize, ProgressChartProps } from "./chartProps"
import { ChartTooltip, useChartTooltip } from "./ChartTooltip"
import { toRatio } from "./progressText"
import {
  chartFocusCss,
  growArc,
  growCapAngle,
  progressColors,
  reducedMotion,
} from "./progressTheme"

const { center: CENTER, radius: RADIUS, stroke: STROKE } = DONUT
// A zero-length path at 12 o'clock; a round linecap turns it into one cap dot, rotated into place.
const CAP_PATH = `M ${CENTER} ${CENTER - RADIUS} h 0`

/** Adds the formatted value and maximum shown in the donut hole. */
export interface DonutProgressProps extends ProgressChartProps {
  centerPrimary: string
  centerSecondary: string
}

function polar(radius: number, ratio: number): { x: number; y: number } {
  const angle = ratio * 2 * Math.PI - Math.PI / 2
  return { x: CENTER + radius * Math.cos(angle), y: CENTER + radius * Math.sin(angle) }
}

const rotateCss = (pathUnits: number) => css`
  transform: rotate(${pathUnits * 3.6}deg);
`

/** Points donut with a labelled radial notch at `required`; the donut is the progressbar. */
const DonutProgress: React.FC<DonutProgressProps> = ({
  value,
  max,
  required,
  tickLabel,
  valueText,
  tooltipLines,
  labelledBy,
  size,
  centerPrimary,
  centerSecondary,
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

  const requiredRatio = required === null ? null : toRatio(required, max)
  const fill = donutFill(toRatio(value, max), requiredRatio)
  const notch =
    requiredRatio === null
      ? null
      : {
          from: polar(RADIUS - DONUT.notchHalfLength, requiredRatio),
          to: polar(RADIUS + DONUT.notchHalfLength, requiredRatio),
          casingFrom: polar(RADIUS - STROKE / 2, requiredRatio),
          casingTo: polar(RADIUS + STROKE / 2, requiredRatio),
          label: polar(DONUT.tickLabelRadius, requiredRatio),
        }

  return (
    <>
      <div
        {...mergeProps(progressBarProps, triggerProps)}
        ref={ref}
        className={cx(rootCss, chartFocusCss, sizeCss[size])}
      >
        <svg viewBox="0 0 256 256" aria-hidden="true" className={svgCss}>
          <g className={ringCss}>
            <circle cx={CENTER} cy={CENTER} r={DONUT.discRadius} className={discCss} />
            <circle cx={CENTER} cy={CENTER} r={RADIUS} strokeWidth={STROKE} className={trackCss} />
            <circle cx={CENTER} cy={CENTER} r={RADIUS - STROKE / 2} className={trackEdgeCss} />
            <circle cx={CENTER} cy={CENTER} r={RADIUS + STROKE / 2} className={trackEdgeCss} />
            {fill && (
              <>
                <circle
                  cx={CENTER}
                  cy={CENTER}
                  r={RADIUS}
                  pathLength={100}
                  strokeWidth={STROKE}
                  strokeDashoffset={-fill.arcStart}
                  transform={`rotate(-90 ${CENTER} ${CENTER})`}
                  className={cx(
                    fillCss,
                    css`
                      stroke-dasharray: ${Math.max(fill.arcEnd - fill.arcStart, 0.001)}
                        ${fill.end === "full" ? 0 : 100};
                    `,
                  )}
                />
                {fill.end !== "full" && (
                  <path
                    data-part="fill-start-cap"
                    d={CAP_PATH}
                    strokeWidth={STROKE}
                    className={cx(capCss, rotateCss(fill.arcStart))}
                  />
                )}
                {fill.end === "round" && (
                  <path
                    data-part="fill-end-cap"
                    d={CAP_PATH}
                    strokeWidth={STROKE}
                    className={cx(
                      capCss,
                      endCapCss,
                      rotateCss(fill.arcEnd),
                      css`
                        --cap-from: ${fill.arcStart * 3.6}deg;
                      `,
                    )}
                  />
                )}
              </>
            )}
            {notch && (
              <>
                <line
                  x1={notch.casingFrom.x}
                  y1={notch.casingFrom.y}
                  x2={notch.casingTo.x}
                  y2={notch.casingTo.y}
                  strokeWidth={DONUT.casingWidth}
                  className={notchCasingCss}
                />
                <line
                  data-part="notch"
                  x1={notch.from.x}
                  y1={notch.from.y}
                  x2={notch.to.x}
                  y2={notch.to.y}
                  strokeWidth={DONUT.notchWidth}
                  className={notchCss}
                />
                <text x={notch.label.x} y={notch.label.y} className={tickLabelCss}>
                  {tickLabel}
                </text>
              </>
            )}
          </g>
        </svg>
        <div className={centerCss} aria-hidden="true">
          <span className={primaryCss}>
            <bdi>{centerPrimary}</bdi>
          </span>
          <span className={secondaryCss}>
            <bdi>{centerSecondary}</bdi>
          </span>
        </div>
      </div>
      <ChartTooltip {...tooltip} lines={tooltipLines} />
    </>
  )
}

export default DonutProgress

const rootCss = css`
  position: relative;
  width: 16rem;
  max-width: 100%;
  margin: 0 auto;
  --donut-tick-label-size: 16px;
`

const svgCss = css`
  display: block;
  width: 100%;
  height: auto;
  overflow: visible;
`

// The fill runs clockwise from 12 o'clock; in RTL it runs counter-clockwise.
const ringCss = css`
  transform-box: view-box;
  transform-origin: ${CENTER}px ${CENTER}px;

  &:dir(rtl) {
    transform: scaleX(-1);
  }
`

const discCss = css`
  fill: ${progressColors.disc};

  @media (forced-colors: active) {
    fill: none;
  }
`

const trackCss = css`
  fill: none;
  stroke: ${progressColors.track};

  @media (forced-colors: active) {
    stroke: Canvas;
  }
`

// Forced colours flatten the track to Canvas; these outline it like the bar's bordered track.
const trackEdgeCss = css`
  display: none;

  @media (forced-colors: active) {
    display: inline;
    fill: none;
    stroke: CanvasText;
    stroke-width: 1;
  }
`

const fillCss = css`
  fill: none;
  stroke: ${progressColors.fill};
  animation: ${growArc} 0.9s ease-out;

  ${reducedMotion} {
    animation: none;
  }

  @media (forced-colors: active) {
    forced-color-adjust: none;
    color: SelectedItem;
    stroke: currentcolor;
  }
`

const capCss = css`
  fill: none;
  stroke: ${progressColors.fill};
  stroke-linecap: round;
  transform-box: view-box;
  transform-origin: ${CENTER}px ${CENTER}px;

  @media (forced-colors: active) {
    forced-color-adjust: none;
    color: SelectedItem;
    stroke: currentcolor;
  }
`

const endCapCss = css`
  animation: ${growCapAngle} 0.9s ease-out;

  ${reducedMotion} {
    animation: none;
  }
`

// Spans the ring only: past its edge the panel colour would show as a halo on the disc.
const notchCasingCss = css`
  stroke: ${progressColors.panel};

  @media (forced-colors: active) {
    stroke: Canvas;
  }
`

const notchCss = css`
  stroke: ${progressColors.tick};
  stroke-linecap: round;

  @media (forced-colors: active) {
    stroke: CanvasText;
  }
`

const tickLabelCss = css`
  font: 600 var(--donut-tick-label-size) ${secondaryFont};
  fill: ${progressColors.tick};
  text-anchor: middle;
  dominant-baseline: central;
  unicode-bidi: isolate;
  direction: ltr;
  transform-box: fill-box;
  transform-origin: center;

  &:dir(rtl) {
    transform: scaleX(-1);
  }

  @media (forced-colors: active) {
    fill: CanvasText;
  }
`

const centerCss = css`
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  font-family: ${headingFont};
  color: ${progressColors.text};
  line-height: 1.1;

  @media (forced-colors: active) {
    color: CanvasText;
  }
`

const primaryCss = css`
  font-size: var(--donut-primary-size, 2.25rem);
  font-weight: 600;
`

const secondaryCss = css`
  font-size: var(--donut-secondary-size, 1rem);
  color: ${progressColors.mutedText};

  @media (forced-colors: active) {
    color: CanvasText;
  }
`

const sizeCss: Record<ChartSize, string> = {
  regular: css`
    ${respondToOrLarger.sm} {
      width: 21rem;
      --donut-primary-size: 3rem;
      --donut-secondary-size: 1.25rem;
      --donut-tick-label-size: 14px;
    }
  `,
  small: css`
    width: 11rem;
    --donut-tick-label-size: 20px;

    ${respondToOrLarger.sm} {
      width: 15rem;
      --donut-primary-size: 2.5rem;
      --donut-secondary-size: 1.125rem;
      --donut-tick-label-size: 15px;
    }
  `,
}
