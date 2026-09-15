"use client"

import { css, cx } from "@emotion/css"
import React from "react"
import { useButton } from "react-aria"

import { ChevronIcon } from "./primitives/ChevronIcon"

/** `card` is a bordered box; `plain` is the same control with no chrome, for use in running text. */
export type DisclosureVariant = "card" | "plain"

export interface DisclosureProps {
  /** Always-visible header content in the trigger row. */
  title: React.ReactNode
  /** Always-visible header content after `title`, e.g. a count or a severity badge. */
  summary?: React.ReactNode
  /** Uncontrolled initial state. */
  defaultExpanded?: boolean
  /** Controlled expanded state; pair with `onExpandedChange`. */
  expanded?: boolean
  onExpandedChange?: (expanded: boolean) => void
  children: React.ReactNode
  variant?: DisclosureVariant
  /** Accessible label for the trigger when `title` is not plain text. */
  "aria-label"?: string
  className?: string
}

const CHEVRON_DIRECTION = "right" as const

const rootCss = css`
  border: 1px solid var(--color-clear-300);
  border-radius: var(--surface-radius);
  overflow: hidden;
  background: var(--color-clear-50);
`

const rootPlainCss = css`
  border: none;
  border-radius: 0;
  overflow: visible;
  background: none;
`

const triggerCss = css`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-3);
  width: 100%;
  padding: var(--space-4);
  border: none;
  background: transparent;
  text-align: left;
  cursor: pointer;
  color: var(--color-gray-700);
  font: inherit;

  &:focus-visible {
    outline: var(--focus-ring-width) solid var(--focus-ring-color);
    outline-offset: calc(var(--focus-ring-offset) * -1);
  }
`

const triggerPlainCss = css`
  padding: var(--space-2) 0;
`

const chevronCss = css`
  display: inline-flex;
  flex: none;
  transition: transform 0.2s ease;
  color: var(--color-gray-600);

  &[data-expanded="true"] {
    transform: rotate(90deg);
  }

  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }
`

const titleWrapCss = css`
  flex: 1 1 auto;
  min-width: 0;
`

const summaryCss = css`
  /* Shrinkable, so a summary too long for the row drops under the title instead of crushing it
     to nothing and painting over it. */
  flex: 0 1 auto;
  min-width: 0;
  color: var(--color-gray-500);
  font-size: var(--font-size-1);
  font-weight: 400;
`

const panelCss = css`
  padding: 0 var(--space-4) var(--space-4);
`

const panelPlainCss = css`
  padding: 0 0 var(--space-3);
`

/** Expand/collapse section built on react-aria `useButton`. Trigger exposes `aria-expanded`/`aria-controls`; the panel is a labelled region, its content rendered lazily. */
export const Disclosure: React.FC<DisclosureProps> = ({
  title,
  summary,
  defaultExpanded = false,
  expanded: expandedProp,
  onExpandedChange,
  children,
  variant = "card",
  "aria-label": ariaLabel,
  className,
}) => {
  const plain = variant === "plain"
  const [internalExpanded, setInternalExpanded] = React.useState(defaultExpanded)
  const isControlled = expandedProp !== undefined
  const expanded = isControlled ? expandedProp : internalExpanded

  const triggerRef = React.useRef<HTMLButtonElement>(null)
  const panelId = React.useId()
  const triggerId = React.useId()

  const toggle = () => {
    const next = !expanded
    if (!isControlled) {
      setInternalExpanded(next)
    }
    onExpandedChange?.(next)
  }

  const { buttonProps } = useButton(
    ariaLabel !== undefined ? { onPress: toggle, "aria-label": ariaLabel } : { onPress: toggle },
    triggerRef,
  )

  return (
    <div className={cx(rootCss, plain && rootPlainCss, className)}>
      <button
        {...buttonProps}
        ref={triggerRef}
        id={triggerId}
        type="button"
        className={cx(triggerCss, plain && triggerPlainCss)}
        aria-expanded={expanded}
        aria-controls={panelId}
      >
        <span className={chevronCss} data-expanded={expanded}>
          <ChevronIcon direction={CHEVRON_DIRECTION} />
        </span>
        <span className={titleWrapCss}>{title}</span>
        {summary !== undefined ? <span className={summaryCss}>{summary}</span> : null}
      </button>
      <section
        id={panelId}
        aria-labelledby={triggerId}
        hidden={!expanded}
        className={cx(panelCss, plain && panelPlainCss)}
      >
        {expanded ? children : null}
      </section>
    </div>
  )
}
