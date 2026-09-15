"use client"

import { css, cx } from "@emotion/css"
import { ArrowRight } from "@vectopus/atlas-icons-react"
import React from "react"

export type StatTileDeltaTone = "positive" | "negative" | "neutral"

/** Surface tones a tile can take. `success` marks the one figure a page is read for. */
export type StatTileTone = "neutral" | "success"

export interface StatTileProps {
  label: React.ReactNode
  value: React.ReactNode
  /** Recolours the value once it is a number above zero; the surface never changes. */
  alertWhenNonZero?: boolean
  /** Tints the whole tile. Reserve `success` for the one figure that carries the page. */
  tone?: StatTileTone
  /** If set, the whole tile becomes a link (e.g. jump to the relevant section). */
  href?: string
  /** Accessible label read as a single phrase, e.g. "Awaiting review: 3". Falls back to label + value. */
  ariaLabel?: string
  /** Change since a prior period, shown beside the value, e.g. "+4" or "−12%". */
  delta?: React.ReactNode
  /** Colours `delta`. Default "neutral": a rise is not always good (e.g. an error count), so the caller decides. */
  deltaTone?: StatTileDeltaTone
  /** Recent values, oldest first, drawn as a small sparkline. Decorative — pair it with `delta` or `ariaLabel` for what a screen reader gets. */
  trend?: number[]
}

const rootCss = css`
  position: relative;
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  /* Fills the row's tallest cell, so a two-line label does not make one tile shorter than its
     neighbours. */
  height: 100%;
  padding: var(--space-4);
  border: 1px solid var(--color-clear-300);
  border-radius: var(--surface-radius);
  background: var(--color-clear-50);
  text-decoration: none;
`

const toneCss: Record<StatTileTone, string | undefined> = {
  neutral: undefined,
  success: css`
    border-color: var(--color-green-100);
    background: var(--color-green-75);
  `,
}

const valueToneCss: Record<StatTileTone, string | undefined> = {
  neutral: undefined,
  success: css`
    color: var(--color-green-700);
  `,
}

const linkCss = css`
  transition:
    border-color 0.15s,
    background 0.15s;

  &:hover {
    border-color: var(--color-gray-300);
    background: var(--color-clear-100);
  }

  &:focus-visible {
    outline: var(--focus-ring-width) solid var(--focus-ring-color);
    outline-offset: var(--focus-ring-offset);
  }
`

const arrowCss = css`
  position: absolute;
  top: var(--space-4);
  right: var(--space-4);
  display: inline-flex;
  color: var(--color-gray-400);
`

const valueRowCss = css`
  display: flex;
  align-items: center;
  gap: var(--space-2);
  /* Room for the corner arrow so it never overlaps a wide value. */
  padding-right: var(--space-5);
`

const valueCss = css`
  font-size: var(--font-size-5);
  font-weight: 700;
  line-height: 1;
  color: var(--color-gray-700);
  font-variant-numeric: tabular-nums;
`

const alertValueCss = css`
  color: var(--color-crimson-700);
`

const deltaCss = css`
  font-size: var(--font-size-1);
  font-weight: 600;
  font-variant-numeric: tabular-nums;
`

const deltaToneCss: Record<StatTileDeltaTone, string> = {
  positive: css`
    color: var(--color-green-700);
  `,
  negative: css`
    color: var(--color-crimson-700);
  `,
  neutral: css`
    color: var(--color-gray-500);
  `,
}

const trendCss = css`
  flex: none;
  width: 4rem;
  height: 1.25rem;
  color: var(--color-gray-400);
`

const labelCss = css`
  font-size: var(--font-size-1);
  color: var(--color-gray-500);
`

const TREND_VIEW_WIDTH = 64
const TREND_VIEW_HEIGHT = 20

/** Polyline points for `trend`, normalised to the sparkline's own viewBox. */
function trendPoints(trend: number[]): string {
  const min = Math.min(...trend)
  const max = Math.max(...trend)
  const span = max - min || 1
  const stepX = TREND_VIEW_WIDTH / (trend.length - 1)
  return trend
    .map(
      (point, index) =>
        `${index * stepX},${TREND_VIEW_HEIGHT - ((point - min) / span) * TREND_VIEW_HEIGHT}`,
    )
    .join(" ")
}

/** At-a-glance metric. Compose several inside `StatTileList` to lay them out as a row. */
export const StatTile: React.FC<StatTileProps> = ({
  label,
  value,
  alertWhenNonZero = false,
  tone = "neutral",
  href,
  ariaLabel,
  delta,
  deltaTone = "neutral",
  trend,
}) => {
  const isAlert = alertWhenNonZero && typeof value === "number" && value > 0
  const body = (
    <>
      <span className={valueRowCss}>
        <span className={cx(valueCss, valueToneCss[tone], isAlert && alertValueCss)}>{value}</span>
        {delta !== undefined ? (
          <span className={cx(deltaCss, deltaToneCss[deltaTone])}>{delta}</span>
        ) : null}
        {trend && trend.length > 1 ? (
          <svg
            className={trendCss}
            viewBox={`0 0 ${TREND_VIEW_WIDTH} ${TREND_VIEW_HEIGHT}`}
            aria-hidden="true"
          >
            <polyline
              points={trendPoints(trend)}
              fill="none"
              stroke="currentColor"
              strokeWidth={1.5}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        ) : null}
      </span>
      <span className={labelCss}>{label}</span>
    </>
  )
  if (href) {
    return (
      <a className={cx(rootCss, toneCss[tone], linkCss)} href={href} aria-label={ariaLabel}>
        {body}
        <span className={arrowCss} aria-hidden="true">
          <ArrowRight size={16} />
        </span>
      </a>
    )
  }
  return (
    <div
      className={cx(rootCss, toneCss[tone])}
      aria-label={ariaLabel}
      role={ariaLabel ? "group" : undefined}
    >
      {body}
    </div>
  )
}
