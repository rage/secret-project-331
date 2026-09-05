"use client"

import { css, cx } from "@emotion/css"
import { useOverlayTriggerState } from "@react-stately/overlays"
import React from "react"
import type { Placement } from "react-aria"

import { Button } from "./Button"
import { Popover } from "./primitives/popover"

// oxlint-disable-next-line i18next/no-literal-string -- a glyph, not user-facing text
const HELP_SYMBOL = "?"

const triggerCss = css`
  font-weight: 700;
`

const contentCss = css`
  padding: var(--space-3) var(--space-4);
  max-width: 320px;
  font-size: var(--font-size-1);
  color: var(--color-gray-700);
  line-height: 1.4;
`

export interface TooltipProps {
  /** Accessible name for the "?" trigger, read instead of the glyph, e.g. "About this setting". */
  "aria-label": string
  /** Help content revealed by the trigger. Keep it to a sentence or two. */
  children: React.ReactNode
  placement?: Placement
  className?: string
  "data-testid"?: string
}

/**
 * A "?" affordance for supplementary text, reachable on touch and announced to screen readers —
 * unlike a `title` attribute.
 *
 * Opens on hover for a mouse, and on press/Enter/Space for touch and keyboard; closes on Escape,
 * an outside click, or tabbing away.
 */
export const Tooltip: React.FC<TooltipProps> = ({
  "aria-label": ariaLabel,
  children,
  placement = "top",
  className,
  "data-testid": dataTestId,
}) => {
  const triggerRef = React.useRef<HTMLButtonElement>(null)
  const popoverRef = React.useRef<HTMLDivElement>(null)
  const contentId = React.useId()
  const state = useOverlayTriggerState({})

  return (
    <>
      <Button
        ref={triggerRef}
        variant="icon"
        size="small"
        aria-label={ariaLabel}
        className={cx(triggerCss, className)}
        onPress={() => state.toggle()}
        onKeyDown={(event) => {
          if (event.key === "Escape" && state.isOpen) {
            event.preventDefault()
            state.close()
            triggerRef.current?.focus()
          }
        }}
        domProps={{
          "aria-expanded": state.isOpen,
          // oxlint-disable-next-line i18next/no-literal-string -- ARIA enum value, not user-facing text
          "aria-haspopup": "dialog",
          "aria-controls": state.isOpen ? contentId : undefined,
          onMouseEnter: () => state.open(),
          onMouseLeave: () => state.close(),
        }}
        data-testid={dataTestId}
      >
        <span aria-hidden="true">{HELP_SYMBOL}</span>
      </Button>
      {state.isOpen ? (
        <Popover
          popoverRef={popoverRef}
          state={state}
          triggerRef={triggerRef}
          placement={placement}
          offset={6}
          isNonModal
          className={contentCss}
          surfaceProps={{
            id: contentId,
            onMouseEnter: () => state.open(),
            onMouseLeave: () => state.close(),
          }}
        >
          {children}
        </Popover>
      ) : null}
    </>
  )
}
