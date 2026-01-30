"use client"

import { css } from "@emotion/css"
import React, { useRef } from "react"
import { useButton } from "react-aria"
import { useTranslation } from "react-i18next"

import type { MobileMenuButtonProps } from "./types"

import Hamburger from "@/shared-module/common/components/Navigation/NavBar/Menu/Hamburger/Hamburger"
import { respondToOrLarger } from "@/shared-module/common/styles/respond"

export const MobileMenuButton: React.FC<MobileMenuButtonProps> = ({ state }) => {
  const { t } = useTranslation()
  const buttonRef = useRef<HTMLButtonElement>(null)
  const { buttonProps } = useButton(
    {
      onPress: state.open,
      "aria-label": t("open-menu"),
      "aria-expanded": state.isOpen,
    },
    buttonRef,
  )

  return (
    <button
      {...buttonProps}
      ref={buttonRef}
      className={css`
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 44px;
        height: 44px;
        border-radius: 999px;
        background: rgba(248, 250, 252, 0.8);
        border: 1px solid rgba(0, 0, 0, 0.08);
        cursor: pointer;
        transition: all 120ms ease;
        box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
        margin-inline-start: auto;

        &:hover {
          background: rgba(241, 245, 249, 0.95);
          border-color: rgba(0, 0, 0, 0.12);
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.08);
        }

        &:active {
          background: rgba(226, 232, 240, 1);
          border-color: rgba(0, 0, 0, 0.16);
          box-shadow: 0 1px 2px rgba(0, 0, 0, 0.12);
        }

        &:focus-visible {
          outline: none;
          box-shadow: 0 0 0 2px #111827;
        }

        ${respondToOrLarger.md} {
          display: none;
        }
      `}
    >
      <Hamburger isActive={state.isOpen} buttonWidth={20} />
    </button>
  )
}
