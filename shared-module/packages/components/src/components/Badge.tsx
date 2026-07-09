"use client"

import { css, cx } from "@emotion/css"
import React from "react"

export type BadgeTone = "neutral" | "info" | "success" | "warning" | "danger"

export interface BadgeProps {
  /** Semantic tone. Colour never carries meaning alone — always pair with text (and ideally an icon). */
  tone?: BadgeTone
  icon?: React.ReactNode
  children: React.ReactNode
  className?: string
  /** Optional hover/tooltip text. */
  title?: string
}

// Tinted-chip recipe: pale background + darker border + dark text. Yellow is intentionally not a tone
// here because the palette's yellow ramp is not contrast-safe as text; "warning" uses the red ramp.
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
    background: var(--color-red-100);
    border-color: var(--color-red-300);
    color: var(--color-red-800);
  `,
  danger: css`
    background: var(--color-crimson-100);
    border-color: var(--color-crimson-300);
    color: var(--color-crimson-800);
  `,
}

const rootCss = css`
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-1) var(--space-3);
  border: 1px solid transparent;
  border-radius: 999px;
  font-size: var(--font-size-1);
  font-weight: 600;
  line-height: 1.2;
  white-space: nowrap;
`

const iconCss = css`
  display: inline-flex;
  align-items: center;
  font-size: 0.9em;
`

/** A small status pill. Reusable across the app for statuses, counts, and labels. */
export const Badge: React.FC<BadgeProps> = ({
  tone = "neutral",
  icon,
  children,
  className,
  title,
}) => (
  <span className={cx(rootCss, toneCss[tone], className)} title={title}>
    {icon ? (
      <span className={iconCss} aria-hidden="true">
        {icon}
      </span>
    ) : null}
    {children}
  </span>
)
