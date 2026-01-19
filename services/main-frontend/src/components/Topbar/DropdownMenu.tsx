"use client"

import { css } from "@emotion/css"
import { ReactElement, ReactNode, useState } from "react"
import { Menu, MenuItem, MenuTrigger, Popover, Separator } from "react-aria-components"
import { useTranslation } from "react-i18next"

import TopBarMenuButton from "./TopBarMenuButton"

import Hamburger from "@/shared-module/common/components/Navigation/NavBar/Menu/Hamburger/Hamburger"

const itemRow = css`
  display: flex;
  align-items: center;
  align-content: flex-start;
  gap: 20px;
  border-radius: 10px;
  padding: 10px 12px;
  font-size: 14px;
  font-weight: 500;
  color: #111827;
  outline: none;
  text-decoration: none !important;
  cursor: pointer;

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
  width: 14px;
  height: 14px;
  opacity: 0.9;
`

const popoverStyle = css`
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
`

interface MenuProps {
  menuTestId: string
  items: DropdownMenuItem[]
  // if the menu is a navigation element
  navLabel: string | null
  controlButtonClassName: string | undefined
  controlButtonIconColor: string | undefined
  controlButtonAriaLabel: string
  controlButtonTooltipText: string
  id?: string
}

export interface DropdownMenuItem {
  id: string
  type: "link" | "action" | "separator"
  label?: string
  href?: string
  onAction?: () => void
  icon?: ReactElement
  isDestructive?: boolean
}

const DropdownMenu: React.FC<MenuProps> = ({
  menuTestId,
  items,
  navLabel,
  controlButtonClassName,
  controlButtonIconColor,
  controlButtonAriaLabel,
  controlButtonTooltipText,
}) => {
  const { t } = useTranslation()
  const [isOpen, setIsOpen] = useState(false)

  let nav =
    navLabel !== null
      ? (z: ReactNode) => <nav aria-label={navLabel}>{z}</nav>
      : (z: ReactNode) => <>{z}</>

  return (
    <MenuTrigger isOpen={isOpen} onOpenChange={setIsOpen}>
      <TopBarMenuButton
        id="topbar-quick-actions"
        ariaLabel={controlButtonAriaLabel} //t("open-quick-actions-menu")
        tooltipText={controlButtonTooltipText} //t("quick-actions")
        showChevron={false}
        className={controlButtonClassName}
      >
        <Hamburger isActive={isOpen} buttonWidth={24} barColor={controlButtonIconColor} />
      </TopBarMenuButton>
      <Popover placement="bottom end" offset={8} className={popoverStyle}>
        {nav(
          <Menu
            data-testid={menuTestId}
            aria-label={t("quick-actions-menu")}
            className={css`
              display: flex;
              flex-direction: column;
              gap: 4px;
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

              const icon = item.icon ? (
                <span aria-hidden className={itemIcon}>
                  {item.icon}
                </span>
              ) : null

              if (item.type === "link") {
                return (
                  <MenuItem key={item.id} href={item.href} className={itemRow}>
                    {icon}
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
                  {icon}
                  <span>{item.label}</span>
                </MenuItem>
              )
            })}
          </Menu>,
        )}
      </Popover>
    </MenuTrigger>
  )
}

export default DropdownMenu
