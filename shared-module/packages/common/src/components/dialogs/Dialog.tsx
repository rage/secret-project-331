import { css, cx } from "@emotion/css"
import { useDialog } from "@react-aria/dialog"
import { FocusScope } from "@react-aria/focus"
import { DismissButton, OverlayContainer, useModal, useOverlay } from "@react-aria/overlays"
import { AriaDialogProps } from "@react-types/dialog"
import React, { useEffect, useRef } from "react"

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
  ...props
}) => {
  const ref = useRef(null)

  const { overlayProps, underlayProps } = useOverlay(
    {
      isOpen: open,
      onClose,
      isDismissable: closeable,
      shouldCloseOnBlur: closeable,
    },
    ref,
  )

  const { modalProps } = useModal()
  const { dialogProps } = useDialog(props, ref)

  useEffect(() => {
    if (open && preventBackgroundScroll) {
      const originalOverflow = document.body.style.overflow
      // eslint-disable-next-line i18next/no-literal-string
      document.body.style.overflow = "hidden"
      return () => {
        document.body.style.overflow = originalOverflow
      }
    }
  }, [open, preventBackgroundScroll])

  if (!open) {
    return null
  }

  return (
    <OverlayContainer>
      <div
        {...underlayProps}
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
            {...overlayProps}
            {...dialogProps}
            {...modalProps}
            ref={ref}
            className={cx(
              props.className,
              css`
                background: white;
                border-radius: 5px;
                width: 95%;
                max-width: ${width === "normal" ? "700px" : "1200px"};
                ${disableContentScroll && "overflow: hidden;"}
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
            data-testid="dialog"
          >
            <div
              className={css`
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
