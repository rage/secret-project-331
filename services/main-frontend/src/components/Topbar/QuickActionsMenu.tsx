/* eslint-disable i18next/no-literal-string */
"use client"

import { css } from "@emotion/css"
import React, { useState } from "react"
import { Menu, MenuItem, MenuTrigger, Popover, Separator } from "react-aria-components"

import TopBarMenuButton from "./TopBarMenuButton"

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

interface MenuOption {
  type: "link" | "action" | "separator"
  label?: string
  href?: string
  onAction?: () => void
  icon?: string
  isDestructive?: boolean
}

interface QuickActionsMenuProps {
  menuOptions?: MenuOption[]
}

type QuickAction = {
  type: "link" | "separator"
  label: string
  href: string
  metadata: { [k: string]: string }
}

const defaultQuickActions = [
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

const QuickActionsMenu: React.FC<QuickActionsMenuProps> = ({ menuOptions }) => {
  const [isOpen, setIsOpen] = useState(false)

  // Use custom menu options if provided, otherwise use defaults
  const quickActions = menuOptions || defaultQuickActions

  return (
    <MenuTrigger isOpen={isOpen} onOpenChange={setIsOpen}>
      <TopBarMenuButton
        id="topbar-quick-actions"
        ariaLabel="Open quick actions menu"
        tooltipText="Quick actions"
        showChevron={false}
      >
        <Hamburger isActive={isOpen} buttonWidth={20} />
      </TopBarMenuButton>

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

              const icon = (
                <span aria-hidden className={itemIcon}>
                  {"icon" in item ? item.icon || "•" : "•"}
                </span>
              )

              if (item.type === "link") {
                return (
                  <MenuItem key={item.href || `link-${idx}`} href={item.href} className={itemRow}>
                    {icon}
                    <span>{item.label}</span>
                  </MenuItem>
                )
              }

              return (
                <MenuItem
                  key={item.label || `action-${idx}`}
                  onAction={item.onAction}
                  className={css`
                    ${itemRow};
                    ${item.isDestructive ? "color: #dc2626; font-weight: 600;" : ""};
                  `}
                >
                  {icon}
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
