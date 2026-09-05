"use client"

import { css, cx } from "@emotion/css"
import React from "react"

export interface StatTileProps {
  label: React.ReactNode
  value: React.ReactNode
  /** Recolours the value once it is a number above zero; the surface never changes. */
  alertWhenNonZero?: boolean
  /** If set, the whole tile becomes a link (e.g. jump to the relevant section). */
  href?: string
  /** Accessible label read as a single phrase, e.g. "Awaiting review: 3". Falls back to label + value. */
  ariaLabel?: string
}

const rootCss = css`
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  padding: var(--space-4);
  border: 1px solid var(--color-clear-300);
  border-radius: var(--surface-radius);
  background: var(--color-clear-50);
  text-decoration: none;
`

const linkCss = css`
  transition:
    border-color 0.15s,
    background 0.15s;
  &:hover {
    border-color: var(--color-gray-300);
    background: var(--color-clear-100);
  }
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

const labelCss = css`
  font-size: var(--font-size-1);
  color: var(--color-gray-500);
`

/** At-a-glance metric. Compose several inside `StatTileList` to lay them out as a row. */
export const StatTile: React.FC<StatTileProps> = ({
  label,
  value,
  alertWhenNonZero = false,
  href,
  ariaLabel,
}) => {
  const isAlert = alertWhenNonZero && typeof value === "number" && value > 0
  const body = (
    <>
      <span className={cx(valueCss, isAlert && alertValueCss)}>{value}</span>
      <span className={labelCss}>{label}</span>
    </>
  )
  if (href) {
    return (
      <a className={cx(rootCss, linkCss)} href={href} aria-label={ariaLabel}>
        {body}
      </a>
    )
  }
  return (
    <div className={rootCss} aria-label={ariaLabel} role={ariaLabel ? "group" : undefined}>
      {body}
    </div>
  )
}
