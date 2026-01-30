"use client"

import { css } from "@emotion/css"
import { ArrowRight } from "@vectopus/atlas-icons-react"
import React from "react"

import { UnifiedMenuItem } from "../hooks/types"

import { iconClass, menuItemClass, separatorClass } from "./styles"

interface MenuItemProps {
  item: UnifiedMenuItem
  onAction: () => void
  onSubmenuOpen: (item: UnifiedMenuItem) => void
}

export const MenuItem: React.FC<MenuItemProps> = ({ item, onAction, onSubmenuOpen }) => {
  if (item.type === "separator") {
    return <div className={separatorClass} />
  }

  const content = (
    <>
      {item.icon && <span className={iconClass}>{item.icon}</span>}
      <span>{item.label}</span>
      {item.type === "submenu" && (
        <ArrowRight
          size={18}
          className={css`
            margin-left: auto;
            color: #6b7280;
          `}
          aria-hidden="true"
        />
      )}
    </>
  )

  if (item.type === "submenu") {
    return (
      <button
        type="button"
        className={menuItemClass}
        onClick={() => onSubmenuOpen(item)}
        lang={item.lang}
        dir={item.dir}
      >
        {content}
      </button>
    )
  }

  if (item.type === "link" && item.href) {
    return (
      <a
        href={item.href}
        className={menuItemClass}
        lang={item.lang}
        dir={item.dir}
        onClick={onAction}
      >
        {content}
      </a>
    )
  }

  return (
    <button
      type="button"
      className={menuItemClass}
      onClick={() => {
        item.onAction?.()
        onAction()
      }}
      lang={item.lang}
      dir={item.dir}
      data-destructive={item.isDestructive ? "true" : undefined}
    >
      {content}
    </button>
  )
}
