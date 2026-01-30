"use client"

import { css } from "@emotion/css"
import { ArrowLeft } from "@vectopus/atlas-icons-react"
import React, { useRef } from "react"
import { useButton } from "react-aria"
import { useTranslation } from "react-i18next"

import { UnifiedMenuItem } from "../hooks/types"

interface MenuHeaderProps {
  currentSubmenu: UnifiedMenuItem | null
  onBack: () => void
  onClose: () => void
}

export const MenuHeader: React.FC<MenuHeaderProps> = ({ currentSubmenu, onBack, onClose }) => {
  const { t } = useTranslation()
  const closeButtonRef = useRef<HTMLButtonElement>(null)

  const { buttonProps: closeButtonProps } = useButton(
    {
      onPress: onClose,
      "aria-label": t("close-heading-menu"),
    },
    closeButtonRef,
  )

  return (
    <div
      className={css`
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 16px 20px;
        border-bottom: 1px solid #e5e7eb;
        position: sticky;
        top: 0;
        background: #ffffff;
        z-index: 1;
      `}
    >
      {currentSubmenu ? (
        <>
          <button
            type="button"
            onClick={onBack}
            className={css`
              display: inline-flex;
              align-items: center;
              gap: 8px;
              background: none;
              border: none;
              padding: 4px 8px;
              cursor: pointer;
              font-size: 16px;
              font-weight: 500;
              color: #111827;
              transition: background-color 120ms ease;
              border-radius: 6px;

              &:hover {
                background: #f3f4f6;
              }

              &:focus-visible {
                outline: none;
                box-shadow: 0 0 0 2px #111827;
              }
            `}
          >
            <ArrowLeft
              size={20}
              className={css`
                color: #111827;
              `}
              // eslint-disable-next-line i18next/no-literal-string
              aria-label="Go back"
            />
            <span>{currentSubmenu.label}</span>
          </button>
          <button
            {...closeButtonProps}
            ref={closeButtonRef}
            className={css`
              display: inline-flex;
              align-items: center;
              justify-content: center;
              width: 36px;
              height: 36px;
              border-radius: 8px;
              background: #f3f4f6;
              border: 1px solid #e5e7eb;
              cursor: pointer;
              transition: all 120ms ease;

              &:hover {
                background: #e5e7eb;
                border-color: #d1d5db;
              }

              &:active {
                background: #d1d5db;
              }

              &:focus-visible {
                outline: none;
                box-shadow: 0 0 0 2px #111827;
              }
            `}
          >
            <span
              className={css`
                font-size: 20px;
                line-height: 1;
              `}
              aria-hidden="true"
            >
              {/* eslint-disable-next-line i18next/no-literal-string */}
              {"×"}
            </span>
          </button>
        </>
      ) : (
        <>
          <h3
            className={css`
              font-size: 18px;
              font-weight: 600;
              color: #111827;
              margin: 0;
            `}
          >
            {t("navigation-menu")}
          </h3>
          <button
            {...closeButtonProps}
            ref={closeButtonRef}
            className={css`
              display: inline-flex;
              align-items: center;
              justify-content: center;
              width: 36px;
              height: 36px;
              border-radius: 8px;
              background: #f3f4f6;
              border: 1px solid #e5e7eb;
              cursor: pointer;
              transition: all 120ms ease;

              &:hover {
                background: #e5e7eb;
                border-color: #d1d5db;
              }

              &:active {
                background: #d1d5db;
              }

              &:focus-visible {
                outline: none;
                box-shadow: 0 0 0 2px #111827;
              }
            `}
          >
            <span
              className={css`
                font-size: 20px;
                line-height: 1;
              `}
              aria-hidden="true"
            >
              {/* eslint-disable-next-line i18next/no-literal-string */}
              {"×"}
            </span>
          </button>
        </>
      )}
    </div>
  )
}
