/* eslint-disable i18next/no-literal-string */
"use client"

import { css } from "@emotion/css"
import { useQueryClient } from "@tanstack/react-query"
import React, { useContext, useState } from "react"
import { Menu, MenuItem, MenuTrigger, Popover, Separator } from "react-aria-components"
import { useTranslation } from "react-i18next"

import TopBarMenuButton from "./TopBarMenuButton"

import Spinner from "@/shared-module/common/components/Spinner"
import LoginStateContext from "@/shared-module/common/contexts/LoginStateContext"
import { logout } from "@/shared-module/common/services/backend/auth"
import { respondToOrLarger } from "@/shared-module/common/styles/respond"
import { useCurrentPagePathForReturnTo } from "@/shared-module/common/utils/redirectBackAfterLoginOrSignup"
import { manageCourseRoute } from "@/shared-module/common/utils/routes"

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
  currentPagePath: string
  courseId?: string | null
  menuOptions?: MenuOption[]
}

const UserMenu: React.FC<React.PropsWithChildren<UserMenuProps>> = ({
  currentPagePath,
  courseId,
  menuOptions,
}) => {
  const { t, i18n } = useTranslation()
  const loginStateContext = useContext(LoginStateContext)
  const [isOpen, setIsOpen] = useState(false)
  const returnTo = useCurrentPagePathForReturnTo(currentPagePath)
  const queryClient = useQueryClient()

  if (loginStateContext.isLoading) {
    return <Spinner variant="large" />
  }

  const submitLogout = async () => {
    await logout()
    queryClient.removeQueries()
    await loginStateContext.refresh()
    setTimeout(() => {
      queryClient.refetchQueries()
    }, 100)
    setIsOpen(false)
  }

  const loginPathWithReturnTo = `/login?return_to=${encodeURIComponent(returnTo)}&lang=${i18n.language}`
  const signUpPathWithReturnTo = `/signup?return_to=${encodeURIComponent(returnTo)}&lang=${i18n.language}`

  // Default menu items
  const defaultUserMenuItems = [
    ...(courseId
      ? [
          {
            type: "action" as const,
            label: t("button-text-manage-course"),
            onAction: () => {
              window.location.href = manageCourseRoute(courseId)
              setIsOpen(false)
            },
          },
        ]
      : []),
    { type: "link" as const, href: "/user-settings", label: t("user-settings") },
    {
      type: "action" as const,
      label: t("log-out"),
      onAction: submitLogout,
    },
  ] as const

  const defaultGuestMenuItems = [
    {
      type: "link" as const,
      href: signUpPathWithReturnTo,
      label: t("create-new-account"),
    },
    { type: "link" as const, href: loginPathWithReturnTo, label: t("log-in") },
  ] as const

  // Use custom menu options if provided, otherwise use defaults
  const userMenuItems = menuOptions || defaultUserMenuItems
  const guestMenuItems = defaultGuestMenuItems

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
            {loginStateContext.signedIn ? "U" : "?"}
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
              ${respondToOrLarger.md} {
                max-width: none;
              }
            `}
          >
            {loginStateContext.signedIn ? "User" : "Guest"}
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
              {loginStateContext.signedIn ? "User Name" : "Guest User"}
            </div>
            <div
              className={css`
                font-size: 13px;
                color: #6b7280;
                margin-top: 2px;
              `}
            >
              {loginStateContext.signedIn ? "user@example.com" : "Not signed in"}
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
            {(loginStateContext.signedIn ? userMenuItems : guestMenuItems).map((item, i) => {
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

              if (item.type === "link") {
                return (
                  <MenuItem key={item.href || `link-${i}`} href={item.href} className={itemRow}>
                    <span>{item.label}</span>
                  </MenuItem>
                )
              }

              return (
                <MenuItem
                  key={item.label || `action-${i}`}
                  onAction={item.onAction}
                  className={itemRow}
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
