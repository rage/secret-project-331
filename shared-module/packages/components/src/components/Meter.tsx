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
  /**
   * Show the label/value row above the bar. When false, the bar is compact and the label is
   * SR-only, so the bar itself carries no visible meaning — only safe on a dashboard where a
   * shared legend already states what every bar in it measures. A bar that stands alone (a table
   * cell, a single card) needs `MeterInline` instead, not `showLabel={false}`.
   */
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
    background: var(--color-yellow-700);
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
    // react-aria sets role="meter progressbar" (an old multi-role fallback trick); axe-core treats
    // that as an invalid role and rejects the aria-value* attributes it puts on the same element.
    // oxlint-disable-next-line jsx-a11y/role-has-required-aria-props -- aria-valuenow is in meterProps
    <div {...meterProps} role="meter" className={cx(rootCss, className)}>
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

export interface MeterInlineProps {
  value: number
  minValue?: number
  maxValue: number
  /** Accessible name. Not displayed — the visible text is `valueText`. */
  label: string
  /** Short visible text beside the bar, e.g. "26 d". Falls back to `valueLabel` for the accessible value text when it is a string. */
  valueText: React.ReactNode
  /** Full accessible value text, e.g. "26 days, past the 1 day threshold". */
  valueLabel?: string
  /** Short visible text after the bar, e.g. the threshold restated as "1 d". */
  secondaryText?: React.ReactNode
  /** Optional reference marker on the same scale as `value` (e.g. a threshold). */
  threshold?: number
  tone?: MeterTone
  className?: string
}

const inlineRootCss = css`
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  max-width: 100%;
`

const inlineValueCss = css`
  color: var(--color-gray-700);
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
`

const inlineSecondaryCss = css`
  color: var(--color-gray-500);
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
`

const inlineTrackCss = css`
  position: relative;
  flex: none;
  width: 3rem;
  height: 6px;
  border-radius: 999px;
  background: var(--color-gray-100);
  overflow: hidden;
`

const inlineTickCss = css`
  position: absolute;
  top: -1px;
  bottom: -1px;
  width: 2px;
  background: var(--color-gray-600);
`

/**
 * A meter's value as text beside a short bar, for a table cell or another dense row where a bare
 * bar (`Meter` with `showLabel={false}`) would carry no visible meaning. The value is always
 * shown — there is no `showLabel` toggle.
 */
export const MeterInline: React.FC<MeterInlineProps> = ({
  value,
  minValue = 0,
  maxValue,
  label,
  valueText,
  valueLabel,
  secondaryText,
  threshold,
  tone = "neutral",
  className,
}) => {
  const resolvedValueLabel = valueLabel ?? (typeof valueText === "string" ? valueText : undefined)
  const { meterProps } = useMeter({
    label,
    value,
    minValue,
    maxValue,
    ...omitUndefined({ valueLabel: resolvedValueLabel }),
    "aria-label": label,
  })

  const fillPct = clampPct(value, minValue, maxValue)
  const thresholdPct = threshold !== undefined ? clampPct(threshold, minValue, maxValue) : null

  return (
    // oxlint-disable-next-line jsx-a11y/role-has-required-aria-props -- aria-valuenow is in meterProps
    <span {...meterProps} role="meter" className={cx(inlineRootCss, className)}>
      <span className={inlineValueCss}>{valueText}</span>
      <span
        className={cx(inlineTrackCss, thresholdPct !== null && trackWithTickCss)}
        aria-hidden="true"
      >
        <span
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
              inlineTickCss,
              css`
                left: ${thresholdPct}%;
              `,
            )}
          />
        ) : null}
      </span>
      {secondaryText ? <span className={inlineSecondaryCss}>{secondaryText}</span> : null}
    </span>
  )
}
