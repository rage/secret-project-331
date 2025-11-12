import styled from "@emotion/styled"
import { FocusEvent, ReactNode, useRef, useState } from "react"
import { useHover } from "react-aria"
import {
  Dialog,
  Popover,
  Button as ReactAriaButton,
  Tooltip,
  TooltipTrigger,
} from "react-aria-components"

import { TooltipBox } from "./TooltipBox"

import { baseTheme } from "@/shared-module/common/styles"

// eslint-disable-next-line i18next/no-literal-string
const StyledButton = styled(ReactAriaButton)`
  text-decoration: underline;
  border: none;
  background: none;
  padding: 2px 4px;
  margin: -2px -4px;
  cursor: help;
  border-radius: 2px;
  transition: background-color 0.15s ease;

  &:hover {
    background-color: ${baseTheme.colors.clear[100]};
  }

  &:focus {
    outline: 2px solid ${baseTheme.colors.blue[500]};
    outline-offset: 2px;
    background-color: ${baseTheme.colors.clear[100]};
  }

  &[data-popover-open="true"] {
    outline: 2px solid ${baseTheme.colors.blue[500]};
    outline-offset: 2px;
    background-color: ${baseTheme.colors.clear[100]};
  }
`

export const GlossaryTriggerNPopover = ({
  className,
  tooltipContent,
  children,
  dialogAriaLabel,
}: {
  className?: string
  tooltipContent: ReactNode
  children: ReactNode
  dialogAriaLabel: string
}) => {
  // Local, fully controlled state
  const [tooltipOpen, setTooltipOpen] = useState(false)
  const [popoverOpen, setPopoverOpen] = useState(false)

  // When the popover closes via overlay interactions, we suppress the next focus tooltip once
  const [suppressNextFocusTooltip, setSuppressNextFocusTooltip] = useState(false)

  // The popover needs a triggerRef when controlled
  const buttonRef = useRef<HTMLButtonElement | null>(null)

  const handleButtonFocus = (_e: FocusEvent) => {
    if (suppressNextFocusTooltip) {
      // Skip showing a tooltip for this focus, then reset after microtask
      queueMicrotask(() => setSuppressNextFocusTooltip(false))
    }
  }

  const { hoverProps } = useHover({
    onHoverStart: () => {
      // Clear suppression when user starts hovering
      if (suppressNextFocusTooltip) {
        setSuppressNextFocusTooltip(false)
        // Allow tooltip to open immediately on hover after clearing suppression
        setTooltipOpen(true)
      }
    },
  })

  return (
    <>
      <TooltipTrigger
        isOpen={suppressNextFocusTooltip ? false : tooltipOpen}
        onOpenChange={(isOpen) => {
          // Respect suppression (e.g., right after popover closes)
          if (suppressNextFocusTooltip && isOpen) {
            return
          }
          setTooltipOpen(isOpen)
        }}
        delay={200}
        closeDelay={200}
      >
        <span {...hoverProps}>
          <StyledButton
            ref={buttonRef}
            className={className}
            data-popover-open={popoverOpen}
            // Open the popover on press start so it appears immediately
            // when TooltipTrigger hides the tooltip on pointer/key down.
            onPressStart={() => {
              setTooltipOpen(false)
              setPopoverOpen(true)
            }}
            // Prevent the mouse press from moving focus, which can
            // re-trigger a focus-based tooltip during transitions.
            preventFocusOnPress
            onFocus={handleButtonFocus}
          >
            {children}
          </StyledButton>
        </span>

        <Tooltip offset={8} placement="top">
          <TooltipBox>{tooltipContent}</TooltipBox>
        </Tooltip>
      </TooltipTrigger>

      <Popover
        offset={8}
        placement="top"
        isNonModal
        // Controlled popover
        isOpen={popoverOpen}
        onOpenChange={(isOpen) => {
          setPopoverOpen(isOpen)
          if (!isOpen) {
            // After closing, suppress the *next* focus tooltip so we don't flash it
            setSuppressNextFocusTooltip(true)
          }
        }}
        // Required when controlling Popover programmatically
        triggerRef={buttonRef}
      >
        <Dialog aria-label={dialogAriaLabel}>
          <TooltipBox>{tooltipContent}</TooltipBox>
        </Dialog>
      </Popover>
    </>
  )
}

export default GlossaryTriggerNPopover
