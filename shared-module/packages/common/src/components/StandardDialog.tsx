import { css } from "@emotion/css"
import React, { useId } from "react"
import { useTranslation } from "react-i18next"

import { typography } from "../styles"

import Button, { ButtonProps } from "./Button"
import Dialog from "./Dialog"

interface StandardDialogProps {
  open: boolean
  onClose?: () => void
  title: string
  children: React.ReactNode
  buttons?: Omit<ButtonProps, "size">[]
  showCloseButton?: boolean
  width?: "normal" | "wide"
  noPadding?: boolean
  className?: string
  backgroundColor?: string
}

const CLOSE_SYMBOL = "×"

const StandardDialog: React.FC<StandardDialogProps> = ({
  open,
  onClose,
  title,
  children,
  buttons,
  showCloseButton = true,
  width = "normal",
  noPadding = false,
  className,
  backgroundColor,
}) => {
  const { t } = useTranslation()
  const titleId = useId()

  return (
    <Dialog
      open={open}
      onClose={onClose}
      width={width}
      noPadding={true}
      className={className}
      role="dialog"
      aria-labelledby={titleId}
    >
      <div
        className={css`
          display: flex;
          flex-direction: column;
          height: 100%;
          position: relative;
          ${backgroundColor && `background-color: ${backgroundColor};`}
        `}
      >
        {showCloseButton && onClose && (
          <button
            onClick={onClose}
            className={css`
              position: absolute;
              top: 1rem;
              right: 1rem;
              background: none;
              border: none;
              padding: 0.5rem;
              cursor: pointer;
              display: flex;
              align-items: center;
              justify-content: center;
              border-radius: 50%;
              transition:
                background-color 0.2s ease,
                box-shadow 0.2s ease;
              font-size: 24px;
              line-height: 1;
              width: 40px;
              height: 40px;
              color: #000;

              &:hover {
                background-color: #f0f0f0;
              }

              &:focus {
                outline: none;
                box-shadow:
                  0 0 0 2px #fff,
                  0 0 0 4px #e0e0e0;
              }
            `}
            aria-label={t("close")}
          >
            {CLOSE_SYMBOL}
          </button>
        )}

        <div
          className={css`
            padding: 1.5rem 2rem;
            border-bottom: 1px solid #eaeaea;
            text-align: center;
          `}
        >
          <h2
            id={titleId}
            className={css`
              font-size: ${typography.h5};
              margin: 0;
              font-weight: 600;
            `}
          >
            {title}
          </h2>
        </div>

        <div
          className={css`
            flex: 1;
            ${!noPadding && `padding: 1rem 2rem;`}
            overflow-y: auto;
          `}
        >
          {children}
        </div>

        {buttons && buttons.length > 0 && (
          <div
            className={css`
              padding: 1rem 2rem;
              padding-top: 0;
              display: flex;
              justify-content: flex-end;
              gap: 1rem;
            `}
          >
            {buttons.map((button, index) => (
              <Button key={index} fullWidth {...button} size="medium" />
            ))}
          </div>
        )}
      </div>
    </Dialog>
  )
}

export default StandardDialog
