"use client"

import { css } from "@emotion/css"
import { useDialog } from "@react-aria/dialog"
import { DismissButton, useModalOverlay } from "@react-aria/overlays"
import { mergeProps } from "@react-aria/utils"
import React, { useMemo, useRef, useState } from "react"
import { useTranslation } from "react-i18next"

import { UnifiedMenuItem } from "../hooks/types"
import { useLanguageMenuItems } from "../hooks/useLanguageMenuItems"
import { useQuickActionsItems } from "../hooks/useQuickActionsItems"
import { useUserMenuItems } from "../hooks/useUserMenuItems"

import { MenuContent } from "./MenuContent"
import { MenuHeader } from "./MenuHeader"
import type { MobileMenuOverlayProps } from "./types"

import { getDir } from "@/shared-module/common/hooks/useLanguage"
import { respondToOrLarger } from "@/shared-module/common/styles/respond"

export const MobileMenuOverlay: React.FC<MobileMenuOverlayProps> = ({
  state,
  primaryNavChildren,
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
}) => {
  const { t, i18n } = useTranslation()
  const overlayRef = useRef<HTMLDivElement>(null)
  const dialogRef = useRef<HTMLDivElement>(null)
  const [currentSubmenu, setCurrentSubmenu] = useState<UnifiedMenuItem | null>(null)

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
        // eslint-disable-next-line i18next/no-literal-string
        id: "mobile-search",
        type: "action",
        label: t("button-label-search-for-pages"),
        icon: "🔍",
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
      const currentLanguageItem = languageMenu.items.find((item) => item.isSelected)
      const currentLanguageName = currentLanguageItem?.nativeLabel || ""

      items.push({
        // eslint-disable-next-line i18next/no-literal-string
        id: "mobile-language-menu",
        type: "submenu",
        label: currentLanguageName,
        // eslint-disable-next-line i18next/no-literal-string
        icon: "language", // Special marker for language menu
        lang: languageMenu.currentLanguage,
        dir: getDir(languageMenu.currentLanguage),
        submenuItems: languageMenu.items.map((langItem) => {
          // eslint-disable-next-line i18next/no-literal-string
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
      // eslint-disable-next-line i18next/no-literal-string
      const loginPathWithReturnTo = `/login?return_to=${encodeURIComponent(returnTo)}&lang=${i18n.language}`
      // eslint-disable-next-line i18next/no-literal-string
      const signUpPathWithReturnTo = `/signup?return_to=${encodeURIComponent(returnTo)}&lang=${i18n.language}`

      items.push({
        // eslint-disable-next-line i18next/no-literal-string
        id: "mobile-signup",
        type: "link",
        label: t("create-new-account"),
        href: signUpPathWithReturnTo,
      })

      items.push({
        // eslint-disable-next-line i18next/no-literal-string
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
  ])

  // Determine which items to display (main menu or submenu)
  const itemsToDisplay = currentSubmenu ? currentSubmenu.submenuItems || [] : mainMenuItems

  // This replaces useOverlay + useModal + scroll locking + focus containment.
  const handleClose = () => {
    state.close()
    onClose?.()
  }

  const { modalProps, underlayProps } = useModalOverlay(
    {
      isDismissable: true, // Allow tap-outside to close
    },
    state,
    overlayRef,
  )

  const { dialogProps, titleProps } = useDialog(
    {
      "aria-label": t("navigation-menu"),
    },
    dialogRef,
  )

  return (
    <div
      {...underlayProps}
      className={css`
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.5);
        backdrop-filter: blur(4px);
        z-index: 1000;
        ${respondToOrLarger.md} {
          display: none !important;
        }
      `}
    >
      <div
        {...modalProps}
        ref={overlayRef}
        className={css`
          position: fixed;
          top: 0;
          right: 0;
          bottom: 0;
          width: 100%;
          max-width: 400px;
          background: #ffffff;
          box-shadow: -4px 0 24px rgba(0, 0, 0, 0.15);
          overflow-y: auto;
          display: flex;
          flex-direction: column;
          z-index: 1001;
          transform: translateX(0);
          transition: transform 300ms cubic-bezier(0.4, 0, 0.2, 1);
          ${respondToOrLarger.md} {
            display: none !important;
          }
        `}
      >
        <div
          {...mergeProps(dialogProps)}
          ref={dialogRef}
          className={css`
            display: flex;
            flex-direction: column;
            height: 100%;
          `}
        >
          {/* Helps screen reader users dismiss easily when tabbing */}
          <DismissButton onDismiss={handleClose} />

          <h2
            {...titleProps}
            className={css`
              position: absolute;
              left: -10000px;
              width: 1px;
              height: 1px;
              overflow: hidden;
            `}
          >
            {t("navigation-menu")}
          </h2>

          <MenuHeader
            currentSubmenu={currentSubmenu}
            onBack={() => setCurrentSubmenu(null)}
            onClose={handleClose}
          />

          <MenuContent
            primaryNavChildren={primaryNavChildren}
            items={itemsToDisplay}
            onItemClick={handleClose}
            onSubmenuOpen={setCurrentSubmenu}
          />

          {/* Helps screen reader users dismiss easily when tabbing */}
          <DismissButton onDismiss={handleClose} />
        </div>
      </div>
    </div>
  )
}
