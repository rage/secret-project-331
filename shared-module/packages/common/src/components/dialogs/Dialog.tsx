"use client"

import { css, cx } from "@emotion/css"
import { useDialog } from "@react-aria/dialog"
import { FocusScope } from "@react-aria/focus"
import {
  DismissButton,
  OverlayContainer,
  useModal,
  useModalOverlay,
  useOverlay,
} from "@react-aria/overlays"
import { mergeProps } from "@react-aria/utils"
import { useOverlayTriggerState } from "@react-stately/overlays"
import { AriaDialogProps } from "@react-types/dialog"
import React, { useRef } from "react"

import { typography } from "../../styles"

interface DialogProps extends AriaDialogProps {
  open: boolean
  onClose?: () => void
  closeable?: boolean
  noPadding?: boolean
  width?: "normal" | "wide"
  disableContentScroll?: boolean
  preventBackgroundScroll?: boolean
  children: React.ReactNode
  className?: string
  "data-testid"?: string
  /** Whether the dialog is closable by clicking outside of it */
  isDismissable?: boolean
  /** Whether the dialog should close when focus moves outside of the dialog */
  shouldCloseOnBlur?: boolean
}

const Dialog: React.FC<DialogProps> = ({
  children,
  open,
  onClose,
  closeable = true,
  noPadding = false,
  width = "normal",
  disableContentScroll = false,
  preventBackgroundScroll = false,
  "data-testid": dataTestId,
  isDismissable = false,
  shouldCloseOnBlur = false,
  ...props
}) => {
  const ref = useRef(null)
  const state = useOverlayTriggerState({
    isOpen: open,
    onOpenChange: (isOpen) => {
      if (!isOpen) {
        onClose?.()
      }
    },
  })

  const { overlayProps, underlayProps } = useOverlay(
    {
      isOpen: open,
      onClose,
      isDismissable: isDismissable,
      shouldCloseOnBlur: shouldCloseOnBlur,
    },
    ref,
  )

  const { modalProps } = useModal()
  const { modalProps: modalOverlayProps, underlayProps: modalOverlayUnderlayProps } =
    useModalOverlay(
      {
        isDismissable,
      },
      state,
      ref,
    )
  const { dialogProps } = useDialog(props, ref)
  const activeUnderlayProps = preventBackgroundScroll ? modalOverlayUnderlayProps : underlayProps
  const activeOverlayProps = mergeProps(
    preventBackgroundScroll ? modalOverlayProps : overlayProps,
    dialogProps,
    preventBackgroundScroll ? {} : modalProps,
  )

  if (!open) {
    return null
  }

  return (
    <OverlayContainer>
      <div
        {...activeUnderlayProps}
        className={css`
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.4);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
          overflow-y: auto;
        `}
      >
        {/* eslint-disable-next-line jsx-a11y/no-autofocus */}
        <FocusScope contain restoreFocus autoFocus>
          <div
            {...activeOverlayProps}
            ref={ref}
            className={cx(
              props.className,
              css`
                background: white;
                border-radius: 5px;
                width: 95%;
                max-width: ${width === "normal" ? "700px" : "1200px"};
                max-height: 90vh;
                display: flex;
                flex-direction: column;
                overflow: hidden;
                outline: none;

                h1 {
                  font-size: ${typography.h5};
                }
                h2,
                h3,
                h4,
                h5,
                h6 {
                  font-size: ${typography.h6};
                }
              `,
            )}
            data-testid={dataTestId ?? "dialog"}
          >
            <div
              className={css`
                flex: 1;
                min-height: 0;
                display: flex;
                flex-direction: column;
                ${!disableContentScroll && !noPadding && "overflow-y: auto;"}
                ${!noPadding && "padding: 2rem 3rem;"}
              `}
            >
              {children}
              {closeable && <DismissButton onDismiss={onClose} />}
            </div>
          </div>
        </FocusScope>
      </div>
    </OverlayContainer>
  )
}
export default Dialog
