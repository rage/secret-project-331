"use client"

import { css, cx } from "@emotion/css"
import React from "react"
import { useMeter } from "react-aria"

import { omitUndefined } from "../lib/utils/nullability"

export type MeterTone = "neutral" | "success" | "warning" | "danger"

export interface MeterProps {
  value: number
  minValue?: number
  maxValue: number
  /** Text label. Shown when `showLabel` is true; always used for the accessible name. */
  label: string
  /** Human-readable value, e.g. "1.4 h of 3 h (47%)". Becomes the accessible value text. */
  valueLabel?: string
  /** Optional reference marker on the same scale as `value` (e.g. a threshold). */
  threshold?: number
  tone?: MeterTone
  /** Show the label/value row above the bar. When false, the bar is compact and label is SR-only. */
  showLabel?: boolean
  className?: string
}

const fillToneCss: Record<MeterTone, string> = {
  neutral: css`
    background: var(--color-gray-400);
  `,
  success: css`
    background: var(--color-green-600);
  `,
  warning: css`
    background: var(--color-red-500);
  `,
  danger: css`
    background: var(--color-crimson-700);
  `,
}

const rootCss = css`
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  width: 100%;
`

const labelRowCss = css`
  display: flex;
  justify-content: space-between;
  gap: var(--space-3);
  font-size: var(--font-size-1);
  color: var(--color-gray-600);
`

const valueTextCss = css`
  color: var(--color-gray-700);
  font-weight: 600;
  font-variant-numeric: tabular-nums;
`

const trackCss = css`
  position: relative;
  width: 100%;
  height: 8px;
  border-radius: 999px;
  background: var(--color-gray-100);
  overflow: hidden;
`

const fillCss = css`
  position: absolute;
  inset: 0 auto 0 0;
  border-radius: 999px;
  transition: width 0.3s ease;

  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }
`

// Threshold marker sits above the fill; keep it outside the clipped track so it stays visible.
const trackWithTickCss = css`
  overflow: visible;
`

const tickCss = css`
  position: absolute;
  top: -2px;
  bottom: -2px;
  width: 2px;
  background: var(--color-gray-600);
`

function clampPct(value: number, min: number, max: number): number {
  if (max <= min) {
    return 0
  }
  return Math.min(100, Math.max(0, ((value - min) / (max - min)) * 100))
}

/** Horizontal meter for a value in a range, with optional threshold marker. Uses react-aria `useMeter`; the visual bar is `aria-hidden`. */
export const Meter: React.FC<MeterProps> = ({
  value,
  minValue = 0,
  maxValue,
  label,
  valueLabel,
  threshold,
  tone = "neutral",
  showLabel = true,
  className,
}) => {
  const { meterProps, labelProps } = useMeter({
    label,
    value,
    minValue,
    maxValue,
    ...omitUndefined({ valueLabel }),
    ...(showLabel ? {} : { "aria-label": label }),
  })

  const fillPct = clampPct(value, minValue, maxValue)
  const thresholdPct = threshold !== undefined ? clampPct(threshold, minValue, maxValue) : null

  return (
    <div {...meterProps} className={cx(rootCss, className)}>
      {showLabel ? (
        <div className={labelRowCss}>
          <span {...labelProps}>{label}</span>
          {valueLabel ? <span className={valueTextCss}>{valueLabel}</span> : null}
        </div>
      ) : null}
      <div className={cx(trackCss, thresholdPct !== null && trackWithTickCss)} aria-hidden="true">
        <div
          className={cx(
            fillCss,
            fillToneCss[tone],
            css`
              width: ${fillPct}%;
            `,
          )}
        />
        {thresholdPct !== null ? (
          <span
            className={cx(
              tickCss,
              css`
                left: ${thresholdPct}%;
              `,
            )}
          />
        ) : null}
      </div>
    </div>
  )
}
