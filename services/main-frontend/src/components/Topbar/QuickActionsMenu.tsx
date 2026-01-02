"use client"

import { css } from "@emotion/css"
import React, { useMemo, useState } from "react"
import { Menu, MenuItem, MenuTrigger, Popover, Separator } from "react-aria-components"
import { useTranslation } from "react-i18next"

import TopBarMenuButton from "./TopBarMenuButton"

import CourseSettingsModal from "@/components/course-material/modals/CourseSettingsModal"
import Hamburger from "@/shared-module/common/components/Navigation/NavBar/Menu/Hamburger/Hamburger"
import useAuthorizeMultiple from "@/shared-module/common/hooks/useAuthorizeMultiple"
import { manageCourseRoute } from "@/shared-module/common/utils/routes"

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
  courseId?: string | null
}

const QuickActionsMenu: React.FC<QuickActionsMenuProps> = ({ menuOptions, courseId }) => {
  const { t } = useTranslation()
  const [isOpen, setIsOpen] = useState(false)
  const [showCourseSettings, setShowCourseSettings] = useState(false)

  const permissionCheck = useAuthorizeMultiple(
    courseId
      ? [
          {
            action: { type: "teach" },
            resource: { type: "course", id: courseId },
          },
        ]
      : [],
  )

  const hasPermission =
    courseId &&
    permissionCheck.isSuccess &&
    permissionCheck.data &&
    permissionCheck.data[0] === true

  const quickActions = useMemo(() => {
    if (menuOptions) {
      return menuOptions
    }

    const items: MenuOption[] = []

    if (courseId && hasPermission) {
      items.push({
        type: "separator",
      })
      items.push({
        type: "action",
        label: t("settings"),
        onAction: () => {
          setShowCourseSettings(true)
          setIsOpen(false)
        },
      })
      items.push({
        type: "link",
        label: t("button-text-manage-course"),
        href: manageCourseRoute(courseId),
      })
    }

    items.push({
      type: "link",
      label: t("user-settings"),
      href: "/user-settings",
    })

    return items
  }, [menuOptions, courseId, hasPermission, t])

  return (
    <>
      {courseId && showCourseSettings && (
        <CourseSettingsModal
          onClose={() => {
            setShowCourseSettings(false)
          }}
          manualOpen={showCourseSettings}
        />
      )}

      <MenuTrigger isOpen={isOpen} onOpenChange={setIsOpen}>
        <TopBarMenuButton
          id="topbar-quick-actions"
          ariaLabel={t("open-quick-actions-menu")}
          tooltipText={t("quick-actions")}
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
          <nav aria-label={t("quick-actions")}>
            <Menu
              aria-label={t("quick-actions-menu")}
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

                const icon =
                  "icon" in item && item.icon ? (
                    <span aria-hidden className={itemIcon}>
                      {item.icon}
                    </span>
                  ) : null

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
    </>
  )
}

export default QuickActionsMenu
