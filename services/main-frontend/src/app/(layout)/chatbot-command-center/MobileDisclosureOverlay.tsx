"use client"

import { css } from "@emotion/css"
import { useDialog } from "@react-aria/dialog"
import { DismissButton, useModalOverlay } from "@react-aria/overlays"
import { mergeProps } from "@react-aria/utils"
import type { OverlayTriggerState } from "@react-stately/overlays"
import React, { useRef, type ReactNode } from "react"
import { useTranslation } from "react-i18next"

import { respondToOrLarger } from "@/shared-module/common/styles/respond"

interface MobileDisclosureOverlay {
  state: OverlayTriggerState
  onClose?: () => void
  children?: ReactNode
}

const MobileDisclosureOverlay: React.FC<MobileDisclosureOverlay> = ({
  state,
  onClose,
  children,
}) => {
  const { t, i18n } = useTranslation()
  const overlayRef = useRef<HTMLDivElement>(null)
  const dialogRef = useRef<HTMLDivElement>(null)

  // This replaces useOverlay + useModal + scroll locking + focus containment.
  const handleClose = () => {
    state.close()
    onClose?.()
  }

  const { modalProps, underlayProps } = useModalOverlay(
    {
      isDismissable: true, // Allow tap-outside to close
    },
    state,
    overlayRef,
  )

  const { dialogProps, titleProps } = useDialog(
    {
      "aria-label": t("navigation-menu"),
    },
    dialogRef,
  )

  return (
    <div
      {...underlayProps}
      className={css`
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        z-index: 1000;
        ${respondToOrLarger.md} {
          display: none !important;
        }
      `}
    >
      <div
        {...modalProps}
        ref={overlayRef}
        className={css`
          position: fixed;
          top: 0;
          left: 0;
          bottom: 0;
          width: 100%;
          max-width: 400px;
          background: #ffffff;
          box-shadow: -4px 0 24px rgba(0, 0, 0, 0.15);
          overflow-y: auto;
          display: flex;
          flex-direction: column;
          z-index: 1001;
          transform: translateX(0);
          transition: transform 300ms cubic-bezier(0.4, 0, 0.2, 1);
          ${respondToOrLarger.md} {
            display: none !important;
          }
        `}
      >
        <div
          {...mergeProps(dialogProps)}
          ref={dialogRef}
          className={css`
            display: flex;
            flex-direction: column;
            height: 100%;
          `}
        >
          {/* Helps screen reader users dismiss easily when tabbing */}
          <DismissButton onDismiss={handleClose} />

          <h2
            {...titleProps}
            className={css`
              position: absolute;
              left: -10000px;
              width: 1px;
              height: 1px;
              overflow: hidden;
            `}
          >
            {t("navigation-menu")}
          </h2>

          <div>{children}</div>

          {/* Helps screen reader users dismiss easily when tabbing */}
          <DismissButton onDismiss={handleClose} />
        </div>
      </div>
    </div>
  )
}

export default MobileDisclosureOverlay
