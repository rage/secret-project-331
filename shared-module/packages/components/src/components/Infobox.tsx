"use client"

import { css, cx } from "@emotion/css"
import { ExclamationTriangle, InfoCircle } from "@vectopus/atlas-icons-react"
import React from "react"

export type InfoboxTone = "info" | "warning"

export interface InfoboxProps {
  /** `info` explains or reassures; `warning` flags something the reader has to act on. */
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
  align-items: center;
  gap: var(--space-3);
  padding: 0.7rem 1rem;
  border: 2px solid transparent;
  border-radius: 8px;
  overflow-x: auto;
`

const toneCss: Record<InfoboxTone, string> = {
  info: css`
    border-color: var(--color-blue-400);
  `,
  // Red rather than yellow: the yellow ramp is not contrast-safe here, same as in Badge.
  warning: css`
    border-color: var(--color-red-400);
  `,
}

const iconToneCss: Record<InfoboxTone, string> = {
  info: css`
    color: var(--color-blue-500);
  `,
  warning: css`
    color: var(--color-red-600);
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
  const Icon = tone === "warning" ? ExclamationTriangle : InfoCircle

  return (
    <div
      className={cx(rootCss, toneCss[tone], className)}
      // `alert` interrupts a screen reader, `status` waits for a pause.
      role={announce ? (tone === "warning" ? "alert" : "status") : undefined}
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
