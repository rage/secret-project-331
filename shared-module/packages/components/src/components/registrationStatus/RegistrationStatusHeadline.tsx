"use client"

import { css, cx } from "@emotion/css"
import React from "react"

import { registrationStatusIcon, type RegistrationStatusState } from "./registrationStatusState"

export interface RegistrationStatusHeadlineProps {
  state: RegistrationStatusState
  /** The translated label. */
  children: React.ReactNode
  className?: string
}

const ICON_SIZE = 24

const rootCss = css`
  display: flex;
  align-items: center;
  gap: var(--space-3);
  margin: 0;
  font-size: var(--font-size-4);
  font-weight: 600;
  line-height: 1.2;
`

// The yellow ramp is not contrast-safe as ink, so action-needed states its case with the warning
// shape and the explanation beside it rather than with colour.
const stateCss: Record<RegistrationStatusState, string> = {
  done: css`
    color: var(--color-green-700);
  `,
  current: css`
    color: var(--color-blue-700);
  `,
  "action-needed": css`
    color: var(--color-gray-800);
  `,
  failed: css`
    color: var(--color-crimson-700);
  `,
  superseded: css`
    color: var(--color-gray-600);
  `,
  upcoming: css`
    color: var(--color-gray-600);
  `,
}

const iconCss = css`
  display: inline-flex;
  align-items: center;
  flex: none;
`

/**
 * The registration's state as the opening statement of a page whose whole job is to report it,
 * with the explanation underneath.
 *
 * Renders no heading element: the page keeps its own heading and this states the news under it.
 * For the same state in a table cell or a card, use `RegistrationStatusBadge`.
 */
export const RegistrationStatusHeadline: React.FC<RegistrationStatusHeadlineProps> = ({
  state,
  children,
  className,
}) => {
  const Icon = registrationStatusIcon[state]

  return (
    <p className={cx(rootCss, stateCss[state], className)}>
      {Icon ? (
        <span className={iconCss} aria-hidden="true">
          <Icon size={ICON_SIZE} />
        </span>
      ) : null}
      <span>{children}</span>
    </p>
  )
}
