"use client"

import { css, cx } from "@emotion/css"
import React from "react"

export type BadgeTone = "neutral" | "info" | "success" | "warning" | "danger"

/** `compact` is for a badge that is the content of a dense table cell rather than a chip in a row. */
export type BadgeSize = "default" | "compact"

export interface BadgeProps {
  /** Semantic tone. Colour alone never carries meaning — pair with text (ideally an icon). */
  tone?: BadgeTone
  size?: BadgeSize
  icon?: React.ReactNode
  children: React.ReactNode
  className?: string
  /** Optional hover-only text. Not reachable on touch and not announced — use `description` for anything the reader needs rather than a nicety. */
  title?: string
  /**
   * Visible explanation rendered under the badge and linked to it via `aria-describedby`, e.g. a
   * pause reason or what a count means. Prefer this over `title` for anything load-bearing.
   */
  description?: React.ReactNode
}

// Tinted chips: pale bg, darker border, dark text. The yellow ramp is not contrast-safe as text, so
// warning carries its hue in the background and border only.
const toneCss: Record<BadgeTone, string> = {
  neutral: css`
    background: var(--color-gray-50);
    border-color: var(--color-gray-200);
    color: var(--color-gray-700);
  `,
  info: css`
    background: var(--color-blue-50);
    border-color: var(--color-blue-200);
    color: var(--color-blue-700);
  `,
  success: css`
    background: var(--color-green-100);
    border-color: var(--color-green-300);
    color: var(--color-green-700);
  `,
  warning: css`
    background: var(--color-yellow-100);
    border-color: var(--color-yellow-700);
    color: var(--color-gray-800);
  `,
  danger: css`
    background: var(--color-crimson-100);
    border-color: var(--color-crimson-300);
    color: var(--color-crimson-800);
  `,
}

const rootCss = css`
  display: inline-flex;
  align-items: flex-start;
  /* Grid defaults an item to justify-self: stretch, pulling a pill out to the whole column. */
  justify-self: start;
  gap: var(--space-2);
  padding: var(--space-1) var(--space-3);
  border: 1px solid transparent;
  border-radius: 999px;
  font-size: var(--font-size-1);
  font-weight: 600;
  line-height: 1.2;
  /* A pill that wraps inside its own outline reads as broken; let the row it sits in wrap instead. */
  white-space: nowrap;
`

const compactCss = css`
  gap: var(--space-1);
  padding: 0 var(--space-2);
`

const iconCss = css`
  display: inline-flex;
  align-items: center;
  font-size: 0.9em;
`

const wrapCss = css`
  display: inline-flex;
  flex-direction: column;
  align-items: flex-start;
  justify-self: start;
  gap: var(--space-1);
`

const descriptionCss = css`
  font-size: var(--font-size-1);
  font-weight: 400;
  color: var(--color-gray-500);
`

/** Status pill. Statuses only: a count or a plain fact reads better as text than as a chip. */
export const Badge: React.FC<BadgeProps> = ({
  tone = "neutral",
  size = "default",
  icon,
  children,
  className,
  title,
  description,
}) => {
  const descriptionId = React.useId()

  const pill = (
    <span
      className={cx(
        rootCss,
        toneCss[tone],
        size === "compact" && compactCss,
        !description && className,
      )}
      title={title}
      {...(description ? { "aria-describedby": descriptionId } : {})}
    >
      {icon ? (
        <span className={iconCss} aria-hidden="true">
          {icon}
        </span>
      ) : null}
      {children}
    </span>
  )

  if (!description) {
    return pill
  }

  return (
    <span className={cx(wrapCss, className)}>
      {pill}
      <span id={descriptionId} className={descriptionCss}>
        {description}
      </span>
    </span>
  )
}
