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

/** Below this the label column eats the value column, so the inline layout stacks instead. */
const STACK_BELOW = "30rem"

const rootInlineCss = css`
  display: grid;
  /* minmax(0, …) on both: without it the longest unwrapped label sets the label column and a long
     unbroken value (a masked address, an id) overflows the value column. */
  grid-template-columns: minmax(0, max-content) minmax(0, 1fr);
  gap: var(--space-2) var(--space-4);
  margin: 0;

  @media (max-width: ${STACK_BELOW}) {
    grid-template-columns: minmax(0, 1fr);
    gap: var(--space-3);
  }
`

const rootStackedCss = css`
  display: grid;
  gap: var(--space-3);
  margin: 0;
`

const inlineItemCss = css`
  display: contents;

  @media (max-width: ${STACK_BELOW}) {
    display: grid;
    gap: var(--space-1);
  }
`

const dtCss = css`
  color: var(--color-gray-500);
  font-size: var(--font-size-1);
  font-weight: 500;
`

const ddCss = css`
  margin: 0;
  min-width: 0;
  color: var(--color-gray-700);
  font-size: var(--font-size-2);
  overflow-wrap: anywhere;
`

/** Semantic key/value list (`<dl>`); associates each label with its value for assistive tech. Use instead of `<p>label: value</p>` rows. */
export const DescriptionList: React.FC<DescriptionListProps> = ({
  items,
  layout = "inline",
  className,
}) => (
  <dl className={cx(layout === "inline" ? rootInlineCss : rootStackedCss, className)}>
    {items.map((item, i) => (
      <div key={i} className={layout === "inline" ? inlineItemCss : undefined}>
        <dt className={dtCss}>{item.label}</dt>
        <dd className={ddCss}>{item.value}</dd>
      </div>
    ))}
  </dl>
)
