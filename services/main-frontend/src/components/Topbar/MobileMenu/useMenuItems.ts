"use client"

import { MagnifyingGlass } from "@vectopus/atlas-icons-react"
import { useMemo } from "react"
import { useTranslation } from "react-i18next"

import { UnifiedMenuItem } from "../hooks/types"
import { useLanguageMenuItems } from "../hooks/useLanguageMenuItems"
import { useQuickActionsItems } from "../hooks/useQuickActionsItems"
import { useUserMenuItems } from "../hooks/useUserMenuItems"

import type { MobileMenuOverlayProps } from "./types"

export function useMenuItems(
  props: MobileMenuOverlayProps & {
    setCurrentSubmenu: (item: UnifiedMenuItem | null) => void
  },
): {
  mainMenuItems: UnifiedMenuItem[]
  itemsToDisplay: UnifiedMenuItem[]
  currentSubmenu: UnifiedMenuItem | null
} {
  const {
    state,
    onClose,
    courseId,
    currentPagePath,
    enableSearch = true,
    enableLanguageMenu = true,
    enableUserMenu = true,
    enableQuickActions = true,
    userMenuOptions,
    quickActionsOptions,
    languageMenuProps,
    setCurrentSubmenu,
  } = props

  const { t, i18n } = useTranslation()

  const languageMenu = useLanguageMenuItems({
    availableLanguages: languageMenuProps?.availableLanguages,
    onLanguageChange: languageMenuProps?.onLanguageChange,
    renderAsSubmenu: true,
    onMenuClose: () => {
      state.close()
      onClose?.()
    },
  })

  const userMenu = useUserMenuItems({
    menuOptions: userMenuOptions,
    onMenuClose: () => {
      state.close()
      onClose?.()
    },
  })

  const quickActions = useQuickActionsItems({
    menuOptions: quickActionsOptions,
    courseId,
    onMenuClose: () => {
      state.close()
      onClose?.()
    },
  })

  // Combine all menu items into a unified list
  const mainMenuItems: UnifiedMenuItem[] = useMemo(() => {
    const items: UnifiedMenuItem[] = []

    // Search button
    if (enableSearch && courseId && currentPagePath) {
      items.push({
        id: "mobile-search",
        type: "action",
        label: t("button-label-search-for-pages"),
        icon: MagnifyingGlass({}),
        onAction: () => {
          const searchButton = document.getElementById("search-for-pages-button")
          if (searchButton) {
            searchButton.click()
          }
          state.close()
          onClose?.()
        },
      })
    }

    // Language menu as submenu
    if (enableLanguageMenu && languageMenu.shouldShow) {
      items.push({
        id: "mobile-language-menu",
        type: "submenu",
        label: t("language"),
        submenuItems: languageMenu.items.map((langItem) => {
          const label = langItem.isSelected ? `${langItem.nativeLabel} ✓` : langItem.nativeLabel
          return {
            id: langItem.id,
            type: "action" as const,
            label,
            onAction: async () => {
              await langItem.onSelect()
              setCurrentSubmenu(null)
            },
            lang: langItem.lang,
            dir: langItem.dir,
          }
        }),
      })
    }

    // User menu items
    if (userMenu.shouldShow && enableUserMenu) {
      items.push(...userMenu.items)
    }

    // Quick actions
    if (quickActions.shouldShow && enableQuickActions) {
      items.push(...quickActions.items)
    }

    // Login/Signup for non-signed-in users
    if (!userMenu.shouldShow) {
      const returnTo = currentPagePath || ""

      const loginPathWithReturnTo = `/login?return_to=${encodeURIComponent(returnTo)}&lang=${i18n.language}`

      const signUpPathWithReturnTo = `/signup?return_to=${encodeURIComponent(returnTo)}&lang=${i18n.language}`

      items.push({
        id: "mobile-signup",
        type: "link",
        label: t("create-new-account"),
        href: signUpPathWithReturnTo,
      })

      items.push({
        id: "mobile-login",
        type: "link",
        label: t("log-in"),
        href: loginPathWithReturnTo,
      })
    }

    return items
  }, [
    enableSearch,
    courseId,
    currentPagePath,
    enableLanguageMenu,
    languageMenu,
    enableUserMenu,
    userMenu,
    enableQuickActions,
    quickActions,
    i18n,
    t,
    state,
    onClose,
    setCurrentSubmenu,
  ])

  // This would need to be passed from the component, but for now we'll return it
  // The component will manage currentSubmenu state
  return {
    mainMenuItems,
    itemsToDisplay: mainMenuItems, // Will be overridden in component
    currentSubmenu: null, // Will be managed in component
  }
}
