"use client"

import { css, cx } from "@emotion/css"
import { useOverlayTriggerState } from "@react-stately/overlays"
import React, { useEffect, useId, useMemo, useRef, useState } from "react"
import type { Placement } from "react-aria"

import { includeIf } from "../lib/utils/nullability"
import { Button } from "./Button"
import { Popover } from "./primitives/popover"
import { comboChevronCss } from "./primitives/selectStyles"

const OVERFLOW_SYMBOL = "⋯"
const ICON_END = "end" as const

const panelCss = css`
  display: grid;
  gap: var(--space-1);
  padding: var(--space-2);
  min-width: 180px;
`

const itemCss = css`
  display: flex;
  align-items: center;
  width: 100%;
  padding: var(--space-2) var(--space-3);
  border: none;
  border-radius: var(--control-radius);
  background: transparent;
  color: var(--color-gray-700);
  font: inherit;
  text-align: left;
  cursor: pointer;

  &:focus-visible {
    outline: var(--focus-ring-width) solid var(--focus-ring-color);
    outline-offset: calc(var(--focus-ring-offset) * -1);
  }

  &:disabled {
    opacity: var(--btn-disabled-opacity);
    cursor: default;
  }

  &:hover:not(:disabled) {
    background: var(--color-clear-200);
  }

  &[data-tone="destructive"] {
    color: var(--color-crimson-700);
  }
`

export interface MenuItemDescriptor {
  key: string
  label: React.ReactNode
  onAction: () => void
  isDisabled?: boolean
  /** Renders the item in the danger palette, for actions like unlinking or cancelling. */
  tone?: "default" | "destructive"
}

export interface MenuProps {
  /** Accessible name for the menu, and for the trigger unless `label` gives it visible text. */
  "aria-label": string
  /**
   * Visible trigger text, for a menu that is a control in its own right rather than a row's
   * overflow: the trigger becomes a quiet button with a dropdown chevron, named by this text.
   */
  label?: React.ReactNode
  items: readonly MenuItemDescriptor[]
  placement?: Placement
  className?: string
  "data-testid"?: string
}

/**
 * A dropdown of row actions collapsed behind a single overflow trigger.
 *
 * Keyboard: ArrowUp/ArrowDown/Home/End move among items, Enter/Space activates, Escape closes and
 * returns focus to the trigger.
 */
export const Menu: React.FC<MenuProps> = ({
  "aria-label": ariaLabel,
  label,
  items,
  placement = "bottom end",
  className,
  "data-testid": dataTestId,
}) => {
  const triggerRef = useRef<HTMLButtonElement>(null)
  const popoverRef = useRef<HTMLDivElement>(null)
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([])
  const contentId = useId()
  const state = useOverlayTriggerState({})
  const [focusedIndex, setFocusedIndex] = useState(0)

  const enabledIndices = useMemo(
    () =>
      items.reduce<number[]>((acc, item, index) => (item.isDisabled ? acc : [...acc, index]), []),
    [items],
  )

  const focusItemAt = (index: number) => {
    setFocusedIndex(index)
    itemRefs.current[index]?.focus()
  }

  useEffect(() => {
    if (!state.isOpen || enabledIndices.length === 0) {
      return
    }
    const firstEnabled = enabledIndices[0] ?? 0
    setFocusedIndex(firstEnabled)
    itemRefs.current[firstEnabled]?.focus()
    // Only the open transition should move focus; re-running on every items/index change would
    // steal focus back from whichever item the user just navigated to.
    // oxlint-disable-next-line react/exhaustive-deps
  }, [state.isOpen])

  const moveFocus = (delta: number) => {
    if (enabledIndices.length === 0) {
      return
    }
    const currentPos = enabledIndices.indexOf(focusedIndex)
    const nextPos = (currentPos + delta + enabledIndices.length) % enabledIndices.length
    focusItemAt(enabledIndices[nextPos] ?? 0)
  }

  const runAction = (item: MenuItemDescriptor) => {
    if (item.isDisabled) {
      return
    }
    item.onAction()
    state.close()
    triggerRef.current?.focus()
  }

  const onMenuKeyDown = (event: React.KeyboardEvent) => {
    switch (event.key) {
      case "ArrowDown":
        event.preventDefault()
        moveFocus(1)
        break
      case "ArrowUp":
        event.preventDefault()
        moveFocus(-1)
        break
      case "Home":
        event.preventDefault()
        if (enabledIndices[0] !== undefined) {
          focusItemAt(enabledIndices[0])
        }
        break
      case "End": {
        event.preventDefault()
        const last = enabledIndices[enabledIndices.length - 1]
        if (last !== undefined) {
          focusItemAt(last)
        }
        break
      }
      case "Escape":
        event.preventDefault()
        state.close()
        triggerRef.current?.focus()
        break
      default:
        break
    }
  }

  return (
    <>
      <Button
        ref={triggerRef}
        variant={label === undefined ? "icon" : "tertiary"}
        size="small"
        {...includeIf(label === undefined, { "aria-label": ariaLabel })}
        {...includeIf(label !== undefined, {
          icon: <span className={comboChevronCss} />,
          iconPosition: ICON_END,
        })}
        className={cx(className)}
        onPress={() => state.toggle()}
        domProps={{
          // oxlint-disable-next-line i18next/no-literal-string -- ARIA enum value, not user-facing text
          "aria-haspopup": "menu",
          "aria-expanded": state.isOpen,
          "aria-controls": state.isOpen ? contentId : undefined,
        }}
        data-testid={dataTestId}
      >
        {label === undefined ? <span aria-hidden="true">{OVERFLOW_SYMBOL}</span> : label}
      </Button>
      {state.isOpen ? (
        <Popover
          popoverRef={popoverRef}
          state={state}
          triggerRef={triggerRef}
          placement={placement}
          offset={4}
          className={panelCss}
          surfaceProps={{
            id: contentId,
            // oxlint-disable-next-line i18next/no-literal-string -- ARIA role, not user-facing text
            role: "menu",
            "aria-label": ariaLabel,
            onKeyDown: onMenuKeyDown,
          }}
        >
          {items.map((item, index) => (
            <button
              key={item.key}
              ref={(el) => {
                itemRefs.current[index] = el
              }}
              type="button"
              role="menuitem"
              tabIndex={focusedIndex === index ? 0 : -1}
              disabled={item.isDisabled}
              data-tone={item.tone}
              className={cx(itemCss)}
              onClick={() => runAction(item)}
            >
              {item.label}
            </button>
          ))}
        </Popover>
      ) : null}
    </>
  )
}
