"use client"

import { css } from "@emotion/css"
import { useOverlayTriggerState } from "@react-stately/overlays"
import React, { useRef } from "react"
import { DismissButton, mergeProps, Overlay, useDialog, usePopover } from "react-aria"

export interface UserDetailsPopoverProps {
  state: ReturnType<typeof useOverlayTriggerState>
  triggerRef: React.RefObject<HTMLButtonElement | null>
  overlayProps: React.HTMLAttributes<HTMLElement>
  className: string
  "aria-label": string
  children: React.ReactNode
}

/** Popover using usePopover; closes on outside click, trigger toggle, or Escape. */
export function UserDetailsPopover({
  state,
  triggerRef,
  overlayProps,
  className,
  "aria-label": ariaLabel,
  children,
}: UserDetailsPopoverProps) {
  const popoverRef = useRef<HTMLDivElement | null>(null)
  const { popoverProps, underlayProps } = usePopover(
    {
      triggerRef,
      popoverRef,
      // eslint-disable-next-line i18next/no-literal-string -- placement value for popover positioning
      placement: "bottom start" as const,
      offset: 8,
    },
    state,
  )
  const dialogRef = useRef<HTMLDivElement | null>(null)
  const { dialogProps } = useDialog({ "aria-label": ariaLabel }, dialogRef)

  return (
    <Overlay>
      <div
        {...underlayProps}
        className={css`
          position: fixed;
          inset: 0;
        `}
      />
      <div {...popoverProps} ref={popoverRef} className={className}>
        <DismissButton onDismiss={() => state.close()} />
        <div {...mergeProps(overlayProps, dialogProps)} ref={dialogRef}>
          {children}
        </div>
        <DismissButton onDismiss={() => state.close()} />
      </div>
    </Overlay>
  )
}
