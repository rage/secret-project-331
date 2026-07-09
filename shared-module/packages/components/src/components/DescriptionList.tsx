"use client"

import { css, cx } from "@emotion/css"
import React from "react"

export interface DescriptionListItem {
  label: React.ReactNode
  value: React.ReactNode
}

export interface DescriptionListProps {
  items: DescriptionListItem[]
  /** Lay the term and detail out side by side (default) or stacked. */
  layout?: "inline" | "stacked"
  className?: string
}

const rootInlineCss = css`
  display: grid;
  grid-template-columns: max-content 1fr;
  gap: var(--space-2) var(--space-4);
  margin: 0;
`

const rootStackedCss = css`
  display: grid;
  gap: var(--space-3);
  margin: 0;
`

const dtCss = css`
  color: var(--color-gray-500);
  font-size: var(--font-size-1);
  font-weight: 500;
`

const ddCss = css`
  margin: 0;
  color: var(--color-gray-700);
  font-size: var(--font-size-2);
`

/** Semantic key/value list (`<dl>`); associates each label with its value for assistive tech. Use instead of `<p>label: value</p>` rows. */
export const DescriptionList: React.FC<DescriptionListProps> = ({
  items,
  layout = "inline",
  className,
}) => (
  <dl className={cx(layout === "inline" ? rootInlineCss : rootStackedCss, className)}>
    {items.map((item, i) => (
      <div
        key={i}
        className={
          layout === "inline"
            ? css`
                display: contents;
              `
            : undefined
        }
      >
        <dt className={dtCss}>{item.label}</dt>
        <dd className={ddCss}>{item.value}</dd>
      </div>
    ))}
  </dl>
)
