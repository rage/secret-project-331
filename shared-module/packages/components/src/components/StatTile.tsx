"use client"

import { css, cx } from "@emotion/css"
import React from "react"

export type StatTileTone = "neutral" | "alert"

export interface StatTileProps {
  label: React.ReactNode
  value: React.ReactNode
  /** "alert" draws attention (e.g. a non-zero review backlog). */
  tone?: StatTileTone
  icon?: React.ReactNode
  /** If set, the whole tile becomes a link (e.g. jump to the relevant section). */
  href?: string
  /** Accessible label read as a single phrase, e.g. "Awaiting review: 3". Falls back to label + value. */
  ariaLabel?: string
  className?: string
}

const rootCss = css`
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  padding: var(--space-4);
  border: 1px solid var(--color-clear-300);
  border-radius: 8px;
  background: var(--color-clear-50);
  text-decoration: none;
  min-width: 7rem;
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

const alertCss = css`
  border-color: var(--color-red-300);
  background: var(--color-red-100);
`

const valueCss = css`
  font-size: var(--font-size-5);
  font-weight: 700;
  line-height: 1;
  color: var(--color-gray-700);
  font-variant-numeric: tabular-nums;
`

const alertValueCss = css`
  color: var(--color-red-800);
`

const labelRowCss = css`
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  font-size: var(--font-size-1);
  color: var(--color-gray-500);
`

const iconCss = css`
  display: inline-flex;
  align-items: center;
`

/** At-a-glance metric. Compose several into a row (wrap the row in a list for structure). */
export const StatTile: React.FC<StatTileProps> = ({
  label,
  value,
  tone = "neutral",
  icon,
  href,
  ariaLabel,
  className,
}) => {
  const isAlert = tone === "alert"
  const body = (
    <>
      <span className={cx(valueCss, isAlert && alertValueCss)}>{value}</span>
      <span className={labelRowCss}>
        {icon ? (
          <span className={iconCss} aria-hidden="true">
            {icon}
          </span>
        ) : null}
        {label}
      </span>
    </>
  )
  const classes = cx(rootCss, isAlert && alertCss, href && linkCss, className)
  if (href) {
    return (
      <a className={classes} href={href} aria-label={ariaLabel}>
        {body}
      </a>
    )
  }
  return (
    <div className={classes} aria-label={ariaLabel} role={ariaLabel ? "group" : undefined}>
      {body}
    </div>
  )
}
