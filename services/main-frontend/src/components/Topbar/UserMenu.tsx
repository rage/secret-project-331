/* eslint-disable i18next/no-literal-string */
"use client"

import { css } from "@emotion/css"
import React, { useContext, useState } from "react"
import { Menu, MenuItem, MenuTrigger, Popover, Separator } from "react-aria-components"

import TopBarMenuButton from "./TopBarMenuButton"
import { useUserMenuItems } from "./hooks/useUserMenuItems"

import Spinner from "@/shared-module/common/components/Spinner"
import LoginStateContext from "@/shared-module/common/contexts/LoginStateContext"
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
  cursor: pointer;
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

interface MenuOption {
  type: "link" | "action" | "separator"
  label?: string
  href?: string
  onAction?: () => void
}

export interface UserMenuProps {
  menuOptions?: MenuOption[]
}

const UserMenu: React.FC<React.PropsWithChildren<UserMenuProps>> = ({ menuOptions }) => {
  const loginStateContext = useContext(LoginStateContext)
  const [isOpen, setIsOpen] = useState(false)

  const { items, displayName, displayInitial, displayEmail, fullDisplayName, shouldShow } =
    useUserMenuItems({
      menuOptions,
      onMenuClose: () => setIsOpen(false),
    })

  if (loginStateContext.isLoading) {
    return <Spinner variant="large" />
  }

  if (!shouldShow) {
    return null
  }

  return (
    <>
      <MenuTrigger isOpen={isOpen} onOpenChange={setIsOpen}>
        <TopBarMenuButton
          id="topbar-user-menu"
          ariaLabel="Open account menu"
          tooltipText="Account menu"
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
            {displayInitial}
          </div>

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
              font-size: 14px;
              ${respondToOrLarger.md} {
                max-width: none;
              }
            `}
          >
            {displayName}
          </span>
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
              {fullDisplayName}
            </div>
            <div
              className={css`
                font-size: 13px;
                color: #6b7280;
                margin-top: 2px;
              `}
            >
              {displayEmail}
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
            {items.map((item) => {
              if (item.type === "separator") {
                return (
                  <Separator
                    key={item.id}
                    className={css`
                      height: 1px;
                      background: #e5e7eb;
                      margin: 4px 0;
                    `}
                  />
                )
              }

              if (item.type === "link") {
                return (
                  <MenuItem key={item.id} href={item.href} className={itemRow}>
                    <span>{item.label}</span>
                  </MenuItem>
                )
              }

              return (
                <MenuItem
                  key={item.id}
                  onAction={item.onAction}
                  className={css`
                    ${itemRow};
                    ${item.isDestructive ? "color: #dc2626; font-weight: 600;" : ""};
                  `}
                >
                  <span>{item.label}</span>
                </MenuItem>
              )
            })}
          </Menu>
        </Popover>
      </MenuTrigger>
    </>
  )
}

export default UserMenu
