"use client"

import { css } from "@emotion/css"
import React, { useContext } from "react"
import { Button as AriaButton, OverlayTriggerStateContext } from "react-aria-components"

import ClarificationTooltip from "../ClarificationTooltip"

const Chevron: React.FC<{ open: boolean }> = ({ open }) => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 20 20"
    aria-hidden
    className={css`
      transition: transform 160ms ease;
      transform: rotate(${open ? 180 : 0}deg);
      opacity: 0.8;
    `}
  >
    <path
      d="M5 7l5 5 5-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
)

interface TopBarMenuButtonProps {
  children: React.ReactNode
  ariaLabel: string
  tooltipText: string
  id?: string
  dataTestId?: string
  className?: string
  onClick?: () => void
  showChevron?: boolean
  lang?: string
  dir?: "ltr" | "rtl"
}

const TopBarMenuButton: React.FC<TopBarMenuButtonProps> = ({
  children,
  ariaLabel,
  tooltipText,
  id,
  dataTestId,
  className,
  onClick,
  showChevron = true,
  lang,
  dir,
}) => {
  const state = useContext(OverlayTriggerStateContext)
  const isOpen = state?.isOpen ?? false
  return (
    <ClarificationTooltip text={tooltipText}>
      <AriaButton
        id={id}
        data-testid={dataTestId}
        aria-label={ariaLabel}
        aria-expanded={isOpen}
        lang={lang}
        dir={dir}
        className={css`
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          padding: 12px 16px;
          height: 44px;
          min-width: fit-content;
          border-radius: 999px;
          background: rgba(248, 250, 252, 0.8);
          border: 1px solid rgba(0, 0, 0, 0.08);
          cursor: pointer;
          transition: all 120ms ease;
          box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
          position: relative;

          &:hover,
          &[data-hovered] {
            background: rgba(241, 245, 249, 0.95);
            border-color: rgba(0, 0, 0, 0.12);
            box-shadow: 0 2px 4px rgba(0, 0, 0, 0.08);
          }
          &[data-pressed] {
            background: rgba(226, 232, 240, 1);
            border-color: rgba(0, 0, 0, 0.16);
            box-shadow: 0 1px 2px rgba(0, 0, 0, 0.12);
          }
          &[data-focus-visible] {
            box-shadow: 0 0 0 2px #111827;
          }

          ${className}
        `}
        onClick={onClick}
      >
        {children}
        {showChevron && <Chevron open={isOpen} />}
      </AriaButton>
    </ClarificationTooltip>
  )
}

export default TopBarMenuButton
