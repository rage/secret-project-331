"use client"

// Unified menu item type that supports all menu types
export interface UnifiedMenuItem {
  id: string
  type: "link" | "action" | "separator" | "submenu"
  label?: string
  href?: string
  onAction?: () => void
  icon?: string
  isDestructive?: boolean
  lang?: string
  dir?: "ltr" | "rtl"
  submenuItems?: UnifiedMenuItem[]
}
