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
} from "react-aria-components"

import { respondToOrLarger } from "@/shared-module/common/styles/respond"

const itemRow = css`
  /* consistent row look */
  display: flex;
  align-items: center;
  gap: 10px;
  border-radius: 10px;
  padding: 10px 12px;
  font-size: 14px;
  font-weight: 500;
  color: #111827;
  outline: none;
  /* kill link underlines across states */
  text-decoration: none !important;

  &:where([data-hovered], [data-focused]) {
    background: #f3f4f6;
  }
  &[data-focus-visible] {
    box-shadow: inset 0 0 0 2px #111827;
  }

  /* ensure anchors inside keep no-underline */
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

const destructiveRow = css`
  color: #dc2626;
  font-weight: 600;

  &:where([data-hovered], [data-focused]) {
    background: #fef2f2;
  }
  &[data-focus-visible] {
    box-shadow: inset 0 0 0 2px #dc2626;
  }
`

const userMenuItems = [
  { type: "link" as const, href: "/profile", label: "My Profile", icon: "👤" },
  { type: "link" as const, href: "/user-settings", label: "Account Settings", icon: "⚙️" },
  { type: "link" as const, href: "/help", label: "Help / Support", icon: "❓" },
  { type: "link" as const, href: "/switch-account", label: "Switch Account", icon: "🔁" },
  { type: "separator" as const },
  {
    type: "action" as const,
    label: "Log out",
    onAction: () => alert("Log out clicked"),
    isDestructive: true,
    icon: "↪️",
  },
] as const

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

const UserMenu: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <MenuTrigger isOpen={isOpen} onOpenChange={setIsOpen}>
      <AriaButton
        slot="trigger"
        id="topbar-user-menu"
        aria-label="Open account menu"
        aria-expanded={isOpen}
        className={css`
          display: inline-flex;
          align-items: center;
          gap: 8px;
          border-radius: 999px;
          padding: 6px 10px;
          background: transparent;
          border: none;
          cursor: pointer;
          transition: background 120ms ease;

          &:hover,
          &[data-pressed],
          &[data-hovered] {
            background: #f3f4f6;
          }
          &[data-focus-visible] {
            box-shadow: 0 0 0 2px #111827;
          }
        `}
      >
        <div
          aria-hidden
          className={css`
            width: 28px;
            height: 28px;
            display: grid;
            place-items: center;
            border-radius: 50%;
            background: #e5e7eb;
            color: #374151;
            font-weight: 600;
            font-size: 12px;
            user-select: none;
            border: 1px solid #d1d5db;
          `}
        >
          U
        </div>

        {/* No "Signed in as" — only the username + chevron */}
        <span
          className={css`
            display: inline-flex;
            align-items: center;
            gap: 6px;
            max-width: 40vw;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
            color: #111827;
            font-weight: 600;
            ${respondToOrLarger.md} {
              max-width: none;
            }
          `}
        >
          User
          <Chevron open={isOpen} />
        </span>
      </AriaButton>

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
            animation: user-menu-enter 120ms ease-out;
          }
          @keyframes user-menu-enter {
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
        {/* header: name + email; optional, no "signed in as" */}
        <div
          className={css`
            padding: 8px 12px;
            border-bottom: 1px solid #e5e7eb;
            margin-bottom: 4px;
          `}
        >
          <div
            className={css`
              font-size: 14px;
              font-weight: 600;
              color: #111827;
            `}
          >
            User Name
          </div>
          <div
            className={css`
              font-size: 13px;
              color: #6b7280;
              margin-top: 2px;
            `}
          >
            user@example.com
          </div>
        </div>

        <Menu
          aria-label="Account actions"
          className={css`
            display: grid;
            gap: 2px;
            outline: none;
          `}
        >
          {userMenuItems.map((item, i) => {
            if (item.type === "separator") {
              return (
                <Separator
                  key={`sep-${i}`}
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
                {/* swap to svg if needed */}
                {("icon" in item && (item as any).icon) || "•"}
              </span>
            )
            if (item.type === "link") {
              return (
                <MenuItem key={item.href} href={item.href} className={itemRow}>
                  {icon}
                  <span>{item.label}</span>
                </MenuItem>
              )
            }
            return (
              <MenuItem
                key={item.label}
                onAction={item.onAction}
                className={css`
                  ${itemRow};
                  ${item.isDestructive ? destructiveRow : ""};
                `}
              >
                {icon}
                <span>{item.label}</span>
              </MenuItem>
            )
          })}
        </Menu>
      </Popover>
    </MenuTrigger>
  )
}

export default UserMenu
