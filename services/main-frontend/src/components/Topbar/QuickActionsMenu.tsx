/* eslint-disable i18next/no-literal-string */
"use client"

import { css } from "@emotion/css"
import React, { useState } from "react"
import {
  Button as AriaButton,
  Menu,
  MenuItem,
  MenuTrigger,
  Popover,
  Separator,
  Tooltip,
  TooltipTrigger,
} from "react-aria-components"

import Hamburger from "@/shared-module/common/components/Navigation/NavBar/Menu/Hamburger/Hamburger"

const itemRow = css`
  display: flex;
  align-items: center;
  gap: 10px;
  border-radius: 10px;
  padding: 10px 12px;
  font-size: 14px;
  font-weight: 500;
  color: #111827;
  outline: none;
  text-decoration: none !important;

  &:where([data-hovered], [data-focused]) {
    background: #f3f4f6;
  }
  &[data-focus-visible] {
    box-shadow: inset 0 0 0 2px #111827;
  }

  &,
  &:is(a),
  &:is(a):hover,
  &:is(a):focus {
    text-decoration: none !important;
  }
`

const itemIcon = css`
  width: 16px;
  height: 16px;
  display: inline-grid;
  place-items: center;
  opacity: 0.9;
`

const quickActions = [
  { type: "link" as const, label: "Search", href: "/search" },
  { type: "link" as const, label: "Change Language", href: "/language" },
  { type: "link" as const, label: "Settings", href: "/user-settings" },
  { type: "link" as const, label: "Keyboard Shortcuts", href: "/shortcuts" },
  { type: "link" as const, label: "Theme", href: "/theme" },
  { type: "link" as const, label: "Language", href: "/language" },
  { type: "separator" as const },
  { type: "link" as const, label: "Help / Docs", href: "/help" },
  { type: "link" as const, label: "Send Feedback", href: "/feedback" },
] as const

const QuickActionsMenu: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <MenuTrigger isOpen={isOpen} onOpenChange={setIsOpen}>
      <TooltipTrigger>
        <AriaButton
          slot="trigger"
          id="topbar-quick-actions"
          aria-label="Open quick actions menu"
          aria-expanded={isOpen}
          className={css`
            padding: 8px 10px;
            display: inline-flex;
            align-items: center;
            gap: 8px;
            justify-content: center;
            cursor: pointer;
            transition: background 120ms ease;
            background: transparent;
            border: none;
            border-radius: 999px;
            outline: none;

            &:hover,
            &[data-hovered] {
              background: #f3f4f6;
            }
            &[data-pressed] {
              background: #e5e7eb;
            }
            &[data-focus-visible] {
              box-shadow: 0 0 0 2px #111827;
            }
          `}
        >
          <Hamburger isActive={isOpen} />
          <span
            className={css`
              font-size: 14px;
              font-weight: 600;
              color: #111827;
              display: none;

              @media (min-width: 768px) {
                display: inline;
              }
            `}
          >
            Menu
          </span>
        </AriaButton>
        <Tooltip
          className={css`
            background: #111827;
            color: #fff;
            padding: 4px 8px;
            border-radius: 6px;
            font-size: 12px;
          `}
        >
          Quick actions
        </Tooltip>
      </TooltipTrigger>

      <Popover
        placement="bottom end"
        offset={8}
        className={css`
          background: #fff;
          border: 1px solid #e5e7eb;
          border-radius: 12px;
          padding: 6px;
          min-width: 260px;
          box-shadow: 0 12px 32px rgba(0, 0, 0, 0.12);
          z-index: 999;

          &[data-entering] {
            animation: pop-enter 120ms ease-out;
          }
          @keyframes pop-enter {
            from {
              opacity: 0;
              transform: scale(0.98);
            }
            to {
              opacity: 1;
              transform: scale(1);
            }
          }
        `}
      >
        <nav aria-label="Quick actions">
          <Menu
            aria-label="Quick actions menu"
            className={css`
              display: grid;
              gap: 4px;
              outline: none;
            `}
          >
            {quickActions.map((item, idx) => {
              if (item.type === "separator") {
                return (
                  <Separator
                    key={`sep-${idx}`}
                    className={css`
                      height: 1px;
                      background: #e5e7eb;
                      margin: 4px 0;
                    `}
                  />
                )
              }
              return (
                <MenuItem key={item.href} href={item.href} className={itemRow}>
                  <span aria-hidden className={itemIcon}>
                    •
                  </span>
                  <span>{item.label}</span>
                </MenuItem>
              )
            })}
          </Menu>
        </nav>
      </Popover>
    </MenuTrigger>
  )
}

export default QuickActionsMenu
