"use client"

import { css, cx } from "@emotion/css"
import type { OverlayTriggerState } from "@react-stately/overlays"
import React from "react"
import { DismissButton, mergeProps, Overlay, usePopover } from "react-aria"
import type { Placement } from "react-aria"

import { popoverCss } from "./selectStyles"

const popoverUnderlayCss = css`
  position: fixed;
  inset: 0;
  z-index: 20;
  pointer-events: none;
`

const popoverSurfaceCss = css`
  pointer-events: auto;
`

export type PopoverProps = React.PropsWithChildren<{
  className?: string
  state: OverlayTriggerState
  triggerRef: React.RefObject<Element | null>
  popoverRef?: React.RefObject<HTMLDivElement | null>
  surfaceProps?: React.HTMLAttributes<HTMLDivElement>
  placement?: Placement
  offset?: number
  isNonModal?: boolean
}>

export function Popover({
  children,
  className,
  state,
  triggerRef,
  popoverRef,
  surfaceProps,
  placement = "bottom start",
  offset = 8,
  isNonModal = false,
}: PopoverProps) {
  const localPopoverRef = React.useRef<HTMLDivElement>(null)
  const resolvedPopoverRef = popoverRef ?? localPopoverRef
  const { popoverProps: overlayProps, underlayProps } = usePopover(
    {
      popoverRef: resolvedPopoverRef,
      triggerRef,
      placement,
      offset,
      isNonModal,
    },
    state,
  )

  const triggerWidth =
    triggerRef.current instanceof HTMLElement ? triggerRef.current.offsetWidth : undefined
  const triggerWidthCss =
    triggerWidth === undefined
      ? undefined
      : css`
          --popover-trigger-width: ${triggerWidth}px;
        `

  return (
    <Overlay disableFocusManagement={isNonModal}>
      <div {...underlayProps} className={popoverUnderlayCss}>
        <div
          {...mergeProps(overlayProps, surfaceProps)}
          ref={resolvedPopoverRef}
          className={cx(
            popoverCss,
            popoverSurfaceCss,
            triggerWidthCss,
            className,
            surfaceProps?.className,
          )}
        >
          <DismissButton onDismiss={state.close} />
          {children}
          <DismissButton onDismiss={state.close} />
        </div>
      </div>
    </Overlay>
  )
}
