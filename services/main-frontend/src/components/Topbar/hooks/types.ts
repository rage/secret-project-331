"use client"

import { ReactElement } from "react"

// Unified menu item type that supports all menu types
export interface UnifiedMenuItem {
  id: string
  type: "link" | "action" | "separator" | "submenu"
  label?: string
  href?: string
  onAction?: () => void
  icon?: ReactElement
  isDestructive?: boolean
  lang?: string
  dir?: "ltr" | "rtl"
  submenuItems?: UnifiedMenuItem[]
}
