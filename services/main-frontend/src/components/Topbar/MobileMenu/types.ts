"use client"

import type { OverlayTriggerState } from "@react-stately/overlays"
import type { ReactElement } from "react"

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
  userMenuOptions?: {
    type: "link" | "action" | "separator"
    label?: string
    href?: string
    onAction?: () => void
    icon?: ReactElement
    isDestructive?: boolean
  }[]
  quickActionsOptions?: {
    type: "link" | "action" | "separator"
    label?: string
    href?: string
    onAction?: () => void
    icon?: ReactElement
    isDestructive?: boolean
  }[]
  languageMenuProps?: {
    availableLanguages?: {
      code: string
      name: string
      isDraft?: boolean
    }[]
    onLanguageChange?: (languageCode: string) => Promise<void>
  }
}
