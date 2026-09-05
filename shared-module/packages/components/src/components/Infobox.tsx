"use client"

import { css, cx } from "@emotion/css"
import { ExclamationTriangle, InfoCircle } from "@vectopus/atlas-icons-react"
import React from "react"

export type InfoboxTone = "info" | "warning" | "danger"

export interface InfoboxProps {
  /** `info` explains, `warning` flags something to act on, `danger` reports a failure. */
  tone?: InfoboxTone
  heading?: React.ReactNode
  children: React.ReactNode
  /** Live region; only for boxes that appear after a user action, not on first paint. */
  announce?: boolean
  className?: string
}

// Metrics match `common`'s GenericInfobox: the two appear side by side on many pages.
const rootCss = css`
  display: flex;
  /* Anchors the icon to the first line; centring strands it beside the middle of a long body. */
  align-items: flex-start;
  gap: var(--space-3);
  padding: 0.875rem 1rem;
  /* An accented edge rather than a full outline: these often sit inside a card or dialog that
     already has one, and a second rounded box inside the first reads as stray chrome. Width is
     per-side but the colour stays a single value, so a tone is still one border-color. */
  border-style: solid;
  border-width: 0 0 0 3px;
  border-color: transparent;
  border-radius: 0 var(--surface-radius) var(--surface-radius) 0;
  overflow-x: auto;
`

const toneCss: Record<InfoboxTone, string> = {
  info: css`
    border-color: var(--color-blue-500);
    background: var(--color-blue-25);
  `,
  // The yellow ramp is not contrast-safe as text, so warning tints only the stripe and background.
  warning: css`
    border-color: var(--color-yellow-700);
    background: var(--color-yellow-100);
  `,
  danger: css`
    border-color: var(--color-crimson-600);
    background: var(--color-crimson-25);
  `,
}

const iconToneCss: Record<InfoboxTone, string> = {
  info: css`
    color: var(--color-blue-500);
  `,
  warning: css`
    color: var(--color-gray-700);
  `,
  danger: css`
    color: var(--color-crimson-600);
  `,
}

const iconCss = css`
  display: inline-flex;
  align-items: center;
  flex: none;
`

const bodyCss = css`
  flex: 1;
`

const headingCss = css`
  display: block;
  margin-bottom: var(--space-2);
  color: var(--color-gray-700);
  font-weight: 600;
`

export const Infobox: React.FC<InfoboxProps> = ({
  tone = "info",
  heading,
  children,
  announce = false,
  className,
}) => {
  const Icon = tone === "info" ? InfoCircle : ExclamationTriangle

  return (
    <div
      className={cx(rootCss, toneCss[tone], className)}
      // `alert` interrupts a screen reader, `status` waits for a pause.
      role={announce ? (tone === "info" ? "status" : "alert") : undefined}
    >
      <span className={cx(iconCss, iconToneCss[tone])} aria-hidden="true">
        <Icon />
      </span>
      <div className={bodyCss}>
        {heading ? <strong className={headingCss}>{heading}</strong> : null}
        {children}
      </div>
    </div>
  )
}
