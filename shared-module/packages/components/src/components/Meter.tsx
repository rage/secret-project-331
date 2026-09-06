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

const DIV_ELEMENT = "div" as const
const SPAN_ELEMENT = "span" as const

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

/**
 * The bar: the tone fill out to `fillPct`, and the threshold tick when there is one.
 *
 * `as` is the track's element, because the inline meter lives inside a `span` and the block one
 * inside a `div`; `tickClassName` differs only in how far the tick overhangs each track's height.
 */
const MeterTrack: React.FC<{
  as: "div" | "span"
  className: string
  fillPct: number
  thresholdPct: number | null
  tickClassName: string
  tone: MeterTone
}> = ({ as: Track, className, fillPct, thresholdPct, tickClassName, tone }) => (
  <Track className={className} aria-hidden="true">
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
          tickClassName,
          css`
            left: ${thresholdPct}%;
          `,
        )}
      />
    ) : null}
  </Track>
)

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
      <MeterTrack
        as={DIV_ELEMENT}
        className={cx(trackCss, thresholdPct !== null && trackWithTickCss)}
        fillPct={fillPct}
        thresholdPct={thresholdPct}
        tickClassName={tickCss}
        tone={tone}
      />
    </div>
  )
}

/** How much room the bar is given: a short fixed length, or everything the row has left. */
export type MeterInlineTrackWidth = "compact" | "fill"

export interface MeterInlineProps {
  value: number
  minValue?: number
  maxValue: number
  /** Accessible name. Not displayed — the visible text is `valueText`. */
  label: string
  /** Short visible text beside the bar, e.g. "26 d". Used as the accessible value text too when `valueLabel` is omitted and this is a string. */
  valueText: React.ReactNode
  /** Full accessible value text, e.g. "26 days, past the 1 day threshold". */
  valueLabel?: string
  /** Short visible text after the bar, e.g. the threshold restated as "1 d". */
  secondaryText?: React.ReactNode
  /** Optional reference marker on the same scale as `value` (e.g. a threshold). */
  threshold?: number
  tone?: MeterTone
  /**
   * `compact`, the default, keeps the bar short and sizes the meter to its own content, for a
   * dense table cell. `fill` spreads the meter across the width it is given and hands the bar
   * whatever the text leaves over, so a column of them can be compared bar to bar. Both hold the
   * bar at the length below which a fill and a threshold tick stop reading.
   */
  trackWidth?: MeterInlineTrackWidth
  className?: string
}

const inlineRootCss = css`
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  max-width: 100%;
`

const inlineRootFillCss = css`
  display: flex;
  width: 100%;
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
  /* Narrower than this and the fill reads as either empty or full and a threshold tick has
     nowhere to sit; it may still give way when the row is tight. */
  flex: 0 1 auto;
  width: 6rem;
  min-width: 3rem;
  height: 6px;
  border-radius: 999px;
  background: var(--color-gray-100);
  overflow: hidden;
`

const inlineTrackFillCss = css`
  flex: 1 1 6rem;
  width: auto;
`

const inlineRootWidthCss: Record<MeterInlineTrackWidth, string | undefined> = {
  compact: undefined,
  fill: inlineRootFillCss,
}

const inlineTrackWidthCss: Record<MeterInlineTrackWidth, string | undefined> = {
  compact: undefined,
  fill: inlineTrackFillCss,
}

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
  trackWidth = "compact",
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
  const rootClassName = cx(inlineRootCss, inlineRootWidthCss[trackWidth], className)
  const trackClassName = cx(
    inlineTrackCss,
    inlineTrackWidthCss[trackWidth],
    thresholdPct !== null && trackWithTickCss,
  )

  return (
    // oxlint-disable-next-line jsx-a11y/role-has-required-aria-props -- aria-valuenow is in meterProps
    <span {...meterProps} role="meter" className={rootClassName}>
      <span className={inlineValueCss}>{valueText}</span>
      <MeterTrack
        as={SPAN_ELEMENT}
        className={trackClassName}
        fillPct={fillPct}
        thresholdPct={thresholdPct}
        tickClassName={inlineTickCss}
        tone={tone}
      />
      {secondaryText ? <span className={inlineSecondaryCss}>{secondaryText}</span> : null}
    </span>
  )
}
