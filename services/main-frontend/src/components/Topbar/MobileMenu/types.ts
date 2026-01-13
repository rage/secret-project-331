"use client"

import type { OverlayTriggerState } from "@react-stately/overlays"

export interface MobileMenuButtonProps {
  state: OverlayTriggerState
}

export interface MobileMenuOverlayProps {
  state: OverlayTriggerState
  primaryNavChildren?: React.ReactNode
  onClose?: () => void
  courseId?: string | null
  currentPagePath?: string
  enableSearch?: boolean
  enableLanguageMenu?: boolean
  enableUserMenu?: boolean
  enableQuickActions?: boolean
  userMenuOptions?: Array<{
    type: "link" | "action" | "separator"
    label?: string
    href?: string
    onAction?: () => void
    icon?: string
    isDestructive?: boolean
  }>
  quickActionsOptions?: Array<{
    type: "link" | "action" | "separator"
    label?: string
    href?: string
    onAction?: () => void
    icon?: string
    isDestructive?: boolean
  }>
  languageMenuProps?: {
    availableLanguages?: Array<{
      code: string
      name: string
      isDraft?: boolean
    }>
    onLanguageChange?: (languageCode: string) => Promise<void>
  }
}
