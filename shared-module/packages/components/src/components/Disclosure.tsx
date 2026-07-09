"use client"

import { css, cx } from "@emotion/css"
import React from "react"
import { useButton } from "react-aria"

export interface DisclosureProps {
  /** Always-visible header content in the trigger row. */
  title: React.ReactNode
  /** Uncontrolled initial state. */
  defaultExpanded?: boolean
  /** Controlled expanded state; pair with `onExpandedChange`. */
  expanded?: boolean
  onExpandedChange?: (expanded: boolean) => void
  children: React.ReactNode
  /** Accessible label for the trigger when `title` is not plain text. */
  "aria-label"?: string
  className?: string
}

const CHEVRON_RIGHT = "▸"

const rootCss = css`
  border: 1px solid var(--color-clear-300);
  border-radius: 8px;
  overflow: hidden;
  background: var(--color-clear-50);
`

const triggerCss = css`
  display: flex;
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

const chevronCss = css`
  flex: none;
  transition: transform 0.2s ease;
  color: var(--color-gray-400);

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

const panelCss = css`
  padding: 0 var(--space-4) var(--space-4);
`

/**
 * An accessible expand/collapse section built on react-aria's `useButton`. The trigger exposes
 * `aria-expanded`/`aria-controls`; the panel is a labelled region and its content is rendered lazily.
 */
export const Disclosure: React.FC<DisclosureProps> = ({
  title,
  defaultExpanded = false,
  expanded: expandedProp,
  onExpandedChange,
  children,
  "aria-label": ariaLabel,
  className,
}) => {
  const [internalExpanded, setInternalExpanded] = React.useState(defaultExpanded)
  const isControlled = expandedProp != null
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

  const { buttonProps } = useButton({ onPress: toggle, "aria-label": ariaLabel }, triggerRef)

  return (
    <div className={cx(rootCss, className)}>
      <button
        {...buttonProps}
        ref={triggerRef}
        id={triggerId}
        type="button"
        className={triggerCss}
        aria-expanded={expanded}
        aria-controls={panelId}
      >
        <span className={chevronCss} data-expanded={expanded} aria-hidden="true">
          {CHEVRON_RIGHT}
        </span>
        <span className={titleWrapCss}>{title}</span>
      </button>
      <div
        id={panelId}
        role="region"
        aria-labelledby={triggerId}
        hidden={!expanded}
        className={panelCss}
      >
        {expanded ? children : null}
      </div>
    </div>
  )
}
