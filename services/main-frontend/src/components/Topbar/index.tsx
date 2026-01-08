/* eslint-disable i18next/no-literal-string */
"use client"

import { css } from "@emotion/css"
import { OverlayContainer } from "@react-aria/overlays"
import { useOverlayTriggerState } from "@react-stately/overlays"
import React, { useContext } from "react"
import { Separator } from "react-aria-components"
import { useTranslation } from "react-i18next"

import Brand from "./Brand"
import LanguageMenu from "./LanguageMenu"
import { MobileMenuButton } from "./MobileMenu/MobileMenuButton"
import { MobileMenuOverlay } from "./MobileMenu/MobileMenuOverlay"
import QuickActionsMenu from "./QuickActionsMenu"
import SearchButton from "./SearchButton"
import UserMenu from "./UserMenu"

import LoginStateContext from "@/shared-module/common/contexts/LoginStateContext"
import { respondToOrLarger } from "@/shared-module/common/styles/respond"
import { useCurrentPagePathForReturnTo } from "@/shared-module/common/utils/redirectBackAfterLoginOrSignup"

interface MenuOption {
  type: "link" | "action" | "separator"
  label?: string
  href?: string
  onAction?: () => void
  icon?: string
  isDestructive?: boolean
  requiresPermission?: boolean
  permissionAction?: string
  permissionResource?: string
}

/**
 * Configurable Topbar component with feature toggles and custom menu options
 *
 * @example
 * // Basic usage with all features enabled
 * <Topbar courseId="123" organizationSlug="org" currentPagePath="/course" />
 *
 * @example
 * // Minimal topbar for non-course pages
 * <Topbar
 *   enableSearch={false}
 *   enableLanguageMenu={true}
 *   enableUserMenu={true}
 *   enableQuickActions={false}
 * />
 *
 * @example
 * // Custom user menu options
 * <Topbar
 *   userMenuOptions={[
 *     { type: "link", label: "Profile", href: "/profile", icon: "👤" },
 *     { type: "separator" },
 *     { type: "action", label: "Logout", onAction: handleLogout, isDestructive: true }
 *   ]}
 * />
 *
 * @example
 * // Language menu with custom options for non-course pages
 * <Topbar
 *   courseId={null}
 *   enableLanguageMenu={true}
 *   languageMenuProps={{
 *     availableLanguages: [
 *       { code: "en", name: "English" },
 *       { code: "fi", name: "Finnish" }
 *     ],
 *     onLanguageChange: async (code) => {
 *       await i18n.changeLanguage(code)
 *       // Handle URL update, etc.
 *     }
 *   }}
 * />
 */

interface LanguageMenuProps {
  availableLanguages?: Array<{
    code: string
    name: string
    isDraft?: boolean
  }>
  onLanguageChange?: (languageCode: string) => Promise<void>
}

interface TopbarProps {
  children?: React.ReactNode
  courseId?: string | null
  organizationSlug?: string | null
  currentPagePath?: string
  // Feature toggles
  enableSearch?: boolean
  enableLanguageMenu?: boolean
  enableUserMenu?: boolean
  enableQuickActions?: boolean
  // Menu customization
  userMenuOptions?: MenuOption[]
  quickActionsOptions?: MenuOption[]
  languageMenuProps?: LanguageMenuProps
}

const Topbar: React.FC<TopbarProps> = ({
  children,
  courseId,
  organizationSlug,
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
  const loginStateContext = useContext(LoginStateContext)
  const returnTo = useCurrentPagePathForReturnTo(currentPagePath || "")

  const loginPathWithReturnTo = `/login?return_to=${encodeURIComponent(returnTo)}&lang=${i18n.language}`
  const signUpPathWithReturnTo = `/signup?return_to=${encodeURIComponent(returnTo)}&lang=${i18n.language}`

  const menuState = useOverlayTriggerState({})

  return (
    <>
      <header
        className={css`
          width: 100%;
          border-bottom: 1px solid #e5e7eb;
          background: rgba(255, 255, 255, 0.8);
          backdrop-filter: saturate(180%) blur(10px);
        `}
      >
        <div
          className={css`
            margin: 0 auto;
            max-width: 1280px;
            padding-inline: 1rem;
          `}
        >
          <div
            className={css`
              display: flex;
              align-items: center;
              height: 4rem;
              gap: 8px;
            `}
            aria-label="Top bar"
          >
            <Brand />

            {/* Middle: primary navigation slot (visible on md+) */}
            <nav
              aria-label="Primary"
              className={css`
                margin-inline-start: 8px;
                min-width: 0;
                flex: 1;
                display: none;
                gap: 8px;
                align-items: center;

                ${respondToOrLarger.md} {
                  display: flex;
                }
              `}
            >
              {children}
            </nav>

            {/* Right cluster: account THEN quick actions (hamburger is rightmost) */}
            <div
              className={css`
                margin-inline-start: auto;
                display: flex;
                align-items: center;
                gap: 4px;

                ${respondToOrLarger.md} {
                  display: flex;
                }

                @media (max-width: 767px) {
                  display: none;
                }
              `}
            >
              {enableSearch && (
                <SearchButton courseId={courseId} organizationSlug={organizationSlug} />
              )}

              {enableLanguageMenu && (
                <LanguageMenu
                  courseId={courseId}
                  currentPageId={currentPagePath}
                  availableLanguages={languageMenuProps?.availableLanguages}
                  onLanguageChange={languageMenuProps?.onLanguageChange}
                />
              )}

              {enableSearch && enableLanguageMenu && (
                <Separator
                  orientation="vertical"
                  className={css`
                    height: 24px;
                    background: #e5e7eb;
                    margin-inline: 4px;
                    display: none;
                    ${respondToOrLarger.md} {
                      display: block;
                    }
                  `}
                />
              )}

              {loginStateContext.signedIn ? (
                <>
                  {enableUserMenu && <UserMenu menuOptions={userMenuOptions} />}

                  {enableUserMenu && enableQuickActions && (
                    <Separator
                      orientation="vertical"
                      className={css`
                        height: 24px;
                        background: #e5e7eb;
                        margin-inline: 4px;
                        display: none;
                        ${respondToOrLarger.md} {
                          display: block;
                        }
                      `}
                    />
                  )}

                  {enableQuickActions && (
                    <QuickActionsMenu menuOptions={quickActionsOptions} courseId={courseId} />
                  )}
                </>
              ) : (
                <div
                  className={css`
                    display: flex;
                    align-items: center;
                    gap: 8px;
                  `}
                >
                  <a
                    href={signUpPathWithReturnTo}
                    className={css`
                      display: inline-flex;
                      align-items: center;
                      justify-content: center;
                      gap: 8px;
                      padding: 10px 16px;
                      height: 40px;
                      border-radius: 999px;
                      background: rgba(248, 250, 252, 0.8);
                      border: 1px solid rgba(0, 0, 0, 0.08);
                      cursor: pointer;
                      transition: all 120ms ease;
                      box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
                      text-decoration: none;
                      color: #374151;
                      font-weight: 500;
                      font-size: 14px;

                      &:hover {
                        background: rgba(241, 245, 249, 0.95);
                        border-color: rgba(0, 0, 0, 0.12);
                        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.08);
                        color: #111827;
                      }

                      &:active {
                        background: rgba(226, 232, 240, 1);
                        border-color: rgba(0, 0, 0, 0.16);
                        box-shadow: 0 1px 2px rgba(0, 0, 0, 0.12);
                      }

                      &:focus-visible {
                        outline: none;
                        box-shadow: 0 0 0 2px #111827;
                      }
                    `}
                  >
                    {t("create-new-account")}
                  </a>

                  <a
                    href={loginPathWithReturnTo}
                    className={css`
                      display: inline-flex;
                      align-items: center;
                      justify-content: center;
                      gap: 8px;
                      padding: 10px 16px;
                      height: 40px;
                      border-radius: 999px;
                      background: #111827;
                      border: 1px solid #111827;
                      cursor: pointer;
                      transition: all 120ms ease;
                      box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
                      text-decoration: none;
                      color: #ffffff;
                      font-weight: 500;
                      font-size: 14px;

                      &:hover {
                        background: #374151;
                        border-color: #374151;
                        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.12);
                      }

                      &:active {
                        background: #1f2937;
                        border-color: #1f2937;
                        box-shadow: 0 1px 2px rgba(0, 0, 0, 0.16);
                      }

                      &:focus-visible {
                        outline: none;
                        box-shadow: 0 0 0 2px #111827;
                      }
                    `}
                  >
                    {t("log-in")}
                  </a>
                </div>
              )}
            </div>

            <MobileMenuButton state={menuState} />
          </div>
        </div>
      </header>
      {menuState.isOpen && (
        <OverlayContainer>
          <MobileMenuOverlay
            state={menuState}
            primaryNavChildren={children}
            onClose={menuState.close}
            courseId={courseId}
            currentPagePath={currentPagePath}
            enableSearch={enableSearch}
            enableLanguageMenu={enableLanguageMenu}
            enableUserMenu={enableUserMenu}
            enableQuickActions={enableQuickActions}
            userMenuOptions={userMenuOptions}
            quickActionsOptions={quickActionsOptions}
            languageMenuProps={languageMenuProps}
          />
        </OverlayContainer>
      )}
    </>
  )
}

export default Topbar
