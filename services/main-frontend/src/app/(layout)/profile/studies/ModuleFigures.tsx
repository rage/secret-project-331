"use client"

import { css } from "@emotion/css"
import React from "react"

import { TONE } from "@/components/credit-registration/constants"
import { Meter, METER_KIND } from "@/shared-module/components"

/** How wide one measured dimension gets. A bar the full width of a card reads as a rule. */
export const FIGURE_WIDTH = "17rem"

/** A `Meter`'s label row without the bar, so a bare figure or the exam result lines up with the bars. */
export const figureRowCss = css`
  display: flex;
  justify-content: space-between;
  gap: var(--space-3);
  max-width: ${FIGURE_WIDTH};
  font-size: var(--font-size-1);
  color: var(--color-gray-600);
`

/** Holds a bare figure to the same weight and digit width as the `Meter` value above it. */
const figureValueCss = css`
  color: var(--color-gray-700);
  font-weight: 600;
  font-variant-numeric: tabular-nums;
`

/** A bar's fill says how far the student has come; the tick beside it says how far is enough. */
const PROGRESS_TONE = TONE.SUCCESS

/**
 * One dimension of a module: a bar where it is measured, otherwise the figure on its own. The
 * threshold tick is drawn only for the dimension that has one.
 */
export const ModuleDimension: React.FC<{
  label: string
  value: number
  maxValue: number
  valueLabel: string
  threshold: number | null
  showBar: boolean
}> = ({ label, value, maxValue, valueLabel, threshold, showBar }) =>
  showBar ? (
    <Meter
      kind={METER_KIND.PROGRESS}
      label={label}
      value={value}
      maxValue={maxValue}
      valueLabel={valueLabel}
      tone={PROGRESS_TONE}
      threshold={threshold}
    />
  ) : (
    <ModuleFigure label={label} value={valueLabel} />
  )

/** A measured value with no threshold to judge it against: a `Meter`'s label row without the bar. */
export const ModuleFigure: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className={figureRowCss}>
    <span>{label}</span>
    <span className={figureValueCss}>{value}</span>
  </div>
)
