"use client"

import { css } from "@emotion/css"
import React from "react"
import { useTranslation } from "react-i18next"

import { UnifiedMenuItem } from "../hooks/types"

import { MenuItem } from "./MenuItem"

interface MenuContentProps {
  primaryNavChildren?: React.ReactNode
  items: UnifiedMenuItem[]
  onItemClick: () => void
  onSubmenuOpen: (item: UnifiedMenuItem) => void
}

export const MenuContent: React.FC<MenuContentProps> = ({
  primaryNavChildren,
  items,
  onItemClick,
  onSubmenuOpen,
}) => {
  const { t } = useTranslation()

  return (
    <div
      className={css`
        flex: 1;
        overflow-y: auto;
        padding: 8px 0;
      `}
    >
      {primaryNavChildren && (
        <>
          <div
            className={css`
              padding: 12px 20px 8px;
              font-size: 12px;
              font-weight: 600;
              color: #6b7280;
              text-transform: uppercase;
              letter-spacing: 0.05em;
            `}
          >
            {t("navigation-menu")}
          </div>
          <div
            className={css`
              display: flex;
              flex-direction: column;
              margin-bottom: 8px;
            `}
          >
            {React.Children.map(primaryNavChildren, (child, index) => (
              <div
                key={index}
                className={css`
                  padding: 0 20px;
                  margin-bottom: 4px;
                `}
              >
                {child}
              </div>
            ))}
          </div>
          {items.length > 0 && (
            <div
              className={css`
                height: 1px;
                background: #e5e7eb;
                margin: 12px 16px;
              `}
            />
          )}
        </>
      )}

      {items.map((item) => (
        <MenuItem key={item.id} item={item} onAction={onItemClick} onSubmenuOpen={onSubmenuOpen} />
      ))}
    </div>
  )
}
