"use client"

import { css, cx } from "@emotion/css"
import React from "react"

const rootCss = css`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-6) var(--space-4);
  text-align: center;
  color: var(--color-gray-600);
`

const iconCss = css`
  font-size: var(--font-size-5);
  color: var(--color-gray-400);
  line-height: 1;
`

const titleCss = css`
  margin: 0;
  font-size: var(--font-size-3);
  font-weight: 600;
  color: var(--color-gray-700);
`

const hintCss = css`
  margin: 0;
  max-width: 48ch;
`

export interface EmptyStateProps {
  title: React.ReactNode
  hint?: React.ReactNode
  /** e.g. a `Button` or `Link` that resolves the empty state — "Clear filters", "Add a link". */
  action?: React.ReactNode
  icon?: React.ReactNode
  className?: string
  "data-testid"?: string
}

/** Placeholder for a table, list, or section with nothing to show. */
export const EmptyState: React.FC<EmptyStateProps> = ({
  title,
  hint,
  action,
  icon,
  className,
  "data-testid": dataTestId,
}) => (
  <div className={cx(rootCss, className)} data-testid={dataTestId}>
    {icon ? (
      <span className={iconCss} aria-hidden="true">
        {icon}
      </span>
    ) : null}
    <p className={titleCss}>{title}</p>
    {hint ? <p className={hintCss}>{hint}</p> : null}
    {action ? <div>{action}</div> : null}
  </div>
)
