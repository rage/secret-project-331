/* eslint-disable i18next/no-literal-string */
"use client"

import { css } from "@emotion/css"
import { LanguageTranslation } from "@vectopus/atlas-icons-react"
import React, { useCallback, useContext, useState } from "react"
import { Menu, MenuItem, MenuTrigger, Popover } from "react-aria-components"
import { useTranslation } from "react-i18next"

import TopBarMenuButton from "./TopBarMenuButton"

//import useLanguageNavigation from "@/hooks/useLanguageNavigation"
import useLanguageNavigation from "@/hooks/course-material/useLanguageNavigation"
import ErrorBanner from "@/shared-module/common/components/ErrorBanner"
import Spinner from "@/shared-module/common/components/Spinner"
import { useDialog } from "@/shared-module/common/components/dialogs/DialogProvider"
import { getDir, SUPPORTED_LANGUAGES } from "@/shared-module/common/hooks/useLanguage"
import { respondToOrLarger } from "@/shared-module/common/styles/respond"

type LanguageCode = "en" | "fi" | "sv" | "de" | "fr"

// Prefer a single source of truth for supported languages

function capitalizeFirst(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1)
}

function getLanguageLabels(targetCode: string, displayLocale: string) {
  const hasIntl = typeof Intl !== "undefined" && typeof Intl.DisplayNames === "function"
  if (!hasIntl) {
    return {
      native: targetCode.toUpperCase(),
      localized: targetCode.toUpperCase(),
      english: targetCode.toUpperCase(),
    }
  }
  const NativeNames = new Intl.DisplayNames(targetCode, { type: "language" })
  const LocalizedNames = new Intl.DisplayNames(displayLocale, { type: "language" })
  const EnglishNames = new Intl.DisplayNames("en", { type: "language" })
  return {
    native: capitalizeFirst(NativeNames.of(targetCode) || targetCode.toUpperCase()),
    localized: capitalizeFirst(LocalizedNames.of(targetCode) || targetCode.toUpperCase()),
    english: capitalizeFirst(EnglishNames.of(targetCode) || targetCode.toUpperCase()),
  }
}

const triggerBtn = css`
  /* Keep DOM stable; structure changes via CSS only */
  display: none;
  ${respondToOrLarger.md} {
    display: inline-flex;
  }
`

const itemRow = css`
  display: grid;
  grid-template-columns: 1fr auto;
  column-gap: 12px;
  align-items: center;
  border-radius: 10px;
  padding: 10px 12px;
  text-decoration: none !important;
  outline: none;
  background: #f9fafb;
  border: 1px solid #e5e7eb;

  &:where([data-hovered], [data-focused]) {
    background: #f3f4f6;
    border-color: #d1d5db;
  }

  &[data-focus-visible] {
    outline: 2px solid #111827;
    outline-offset: 2px;
  }

  &,
  &:is(a),
  &:is(a):hover,
  &:is(a):focus {
    text-decoration: none !important;
  }
`

const selectedItem = css`
  background: #3b82f6 !important;
  border-color: #2563eb !important;

  &:where([data-hovered], [data-focused]) {
    background: #2563eb !important;
    border-color: #1d4ed8 !important;
  }
`

const selectedText = css`
  color: #ffffff !important;
`

const selectedSubtext = css`
  color: #dbeafe !important;
`

const textCol = css`
  min-width: 0;
  display: grid;
  gap: 2px;
`

const primaryLine = css`
  font-size: 14px;
  font-weight: 600;
  color: #111827;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`

const secondaryLine = css`
  font-size: 12px;
  color: #6b7280;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`

const checkCell = css`
  width: 20px;
  height: 20px;
  display: inline-grid;
  place-items: center;
  opacity: 0.9;
  flex: 0 0 20px;
  font-size: 14px;
  font-weight: bold;
  color: #ffffff;
`

const footerMessage = css`
  padding: 16px 12px 10px;
  margin-top: 8px;
  text-align: center;
  font-size: 13px;
  font-weight: 600;
  color: #9ca3af;
  border-top: 1px solid #e5e7eb;
  letter-spacing: 0.02em;
  font-style: italic;
`

interface LanguageMenuProps {
  placement?: "bottom-end" | "bottom-start"
  // Optional props for non-course pages
  courseId?: string | null
  currentPageId?: string | null
  availableLanguages?: Array<{
    code: string
    name: string
    isDraft?: boolean
  }>
  onLanguageChange?: (languageCode: string) => Promise<void>
}

// Helper component that handles the hook availability
const LanguageMenuWithHook: React.FC<
  LanguageMenuProps & {
    layoutContext?: any
    pageState?: any
  }
> = ({
  placement = "bottom-end",
  courseId: propCourseId,
  currentPageId: propCurrentPageId,
  availableLanguages: propAvailableLanguages,
  onLanguageChange: propOnLanguageChange,
  layoutContext,
  pageState,
}) => {
  const { alert } = useDialog()
  const { t, i18n } = useTranslation()
  const [isOpen, setIsOpen] = useState(false)

  // Determine which data to use - props take precedence
  const currentCourseId = (propCourseId || layoutContext?.courseId || pageState?.course?.id) ?? null
  const currentPageId = (propCurrentPageId || pageState?.pageData?.id) ?? null

  // Try to use the hook if we have course context and no explicit props
  let hookResult: any = null
  if (currentCourseId && !propAvailableLanguages) {
    try {
      hookResult = useLanguageNavigation({
        currentCourseId,
        currentPageId,
      })
    } catch (e) {
      // Hook not available, will use props
    }
  }

  // Use hook result if available, otherwise use props
  const availableLanguages = hookResult?.availableLanguages || propAvailableLanguages || []
  const redirectToLanguage = hookResult?.redirectToLanguage || propOnLanguageChange
  const isLoading = hookResult?.isLoading || false
  const error = hookResult?.error || null

  const current = (i18n.resolvedLanguage || i18n.language || "en").split("-")[0] // normalize
  const active = SUPPORTED_LANGUAGES.includes(current as LanguageCode)
    ? (current as LanguageCode)
    : "en"
  const { native: activeNative } = getLanguageLabels(active, active) // button shows native name

  const handleLanguageChange = useCallback(
    async (newLanguageCode: string) => {
      try {
        if (redirectToLanguage) {
          await redirectToLanguage(newLanguageCode)
        } else {
          // Fallback to basic i18n change
          await i18n.changeLanguage(newLanguageCode)
        }
        setIsOpen(false)
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err)
        console.error("Language redirection failed:", errorMessage)
        alert(t("language-redirection-failed", { error: errorMessage }))
      }
    },
    [redirectToLanguage, i18n, alert, t],
  )

  if (error) {
    return <ErrorBanner error={error} />
  }

  if (isLoading) {
    return <Spinner variant="medium" />
  }

  // If we have course-specific language navigation, use that
  if (availableLanguages.length > 1) {
    const languageOptions = availableLanguages.map((lang) => ({
      code: lang.code,
      name: lang.isDraft ? `${lang.name} (${t("draft")})` : lang.name,
    }))

    return (
      <MenuTrigger isOpen={isOpen} onOpenChange={setIsOpen}>
        <TopBarMenuButton
          ariaLabel={`Change language, current ${activeNative}`}
          tooltipText={`Change language, current: ${activeNative}`}
          className={triggerBtn}
          lang={active}
          dir={getDir(active)}
        >
          <LanguageTranslation size={18} />
          <span
            className={css`
              font-size: 14px;
              font-weight: 600;
              color: #111827;
            `}
          >
            {activeNative}
          </span>
        </TopBarMenuButton>

        <Popover
          placement={placement === "bottom-end" ? "bottom end" : "bottom start"}
          offset={8}
          lang={active}
          dir={getDir(active)}
          className={css`
            background: #fff;
            border: 1px solid #e5e7eb;
            border-radius: 12px;
            padding: 6px;
            min-width: 260px;
            box-shadow: 0 12px 32px rgba(0, 0, 0, 0.12);
            z-index: 999;
          `}
        >
          <Menu
            aria-label="Language selection"
            className={css`
              display: grid;
              gap: 4px;
              outline: none;
            `}
          >
            {languageOptions.map((lang) => {
              const { native, localized, english } = getLanguageLabels(lang.code, active)
              const selected = lang.code === active
              const subtitle = selected ? english : localized
              return (
                <MenuItem
                  key={lang.code}
                  onAction={() => handleLanguageChange(lang.code)}
                  className={`${itemRow} ${selected ? selectedItem : ""}`}
                  aria-current={selected ? "true" : undefined}
                  lang={lang.code}
                  dir={getDir(lang.code)}
                >
                  <span className={textCol}>
                    <span
                      className={`${primaryLine} ${selected ? selectedText : ""}`}
                      lang={lang.code}
                      dir={getDir(lang.code)}
                    >
                      {native}
                    </span>
                    <span
                      className={`${secondaryLine} ${selected ? selectedSubtext : ""}`}
                      lang={selected ? "en" : active}
                      dir={selected ? getDir("en") : getDir(active)}
                    >
                      {subtitle}
                    </span>
                  </span>
                  <span aria-hidden className={checkCell}>
                    {selected ? "✓" : ""}
                  </span>
                </MenuItem>
              )
            })}
          </Menu>
          <div className={footerMessage}>Glory to Arstotzka!</div>
        </Popover>
      </MenuTrigger>
    )
  }

  // Fallback to basic language switching if no course-specific languages
  const changeLang = async (code: string) => {
    if (code === active) {
      return
    }
    await i18n.changeLanguage(code)
    setIsOpen(false)
  }

  return (
    <MenuTrigger isOpen={isOpen} onOpenChange={setIsOpen}>
      <TopBarMenuButton
        ariaLabel={`Change language, current ${activeNative}`}
        tooltipText={`Change language, current: ${activeNative}`}
        className={triggerBtn}
        lang={active}
        dir={getDir(active)}
      >
        <LanguageTranslation size={18} />
        <span
          className={css`
            font-size: 14px;
            font-weight: 600;
            color: #111827;
          `}
        >
          {activeNative}
        </span>
      </TopBarMenuButton>

      <Popover
        placement={placement === "bottom-end" ? "bottom end" : "bottom start"}
        offset={8}
        lang={active}
        dir={getDir(active)}
        className={css`
          background: #fff;
          border: 1px solid #e5e7eb;
          border-radius: 12px;
          padding: 6px;
          min-width: 260px;
          box-shadow: 0 12px 32px rgba(0, 0, 0, 0.12);
          z-index: 999;
        `}
      >
        <Menu
          aria-label="Language selection"
          className={css`
            display: grid;
            gap: 4px;
            outline: none;
          `}
        >
          {SUPPORTED_LANGUAGES.map((code) => {
            const { native, localized, english } = getLanguageLabels(code, active)
            const selected = code === active
            const subtitle = selected ? english : localized
            return (
              <MenuItem
                key={code}
                onAction={() => changeLang(code)}
                className={`${itemRow} ${selected ? selectedItem : ""}`}
                aria-current={selected ? "true" : undefined}
                lang={code}
                dir={getDir(code)}
              >
                <span className={textCol}>
                  <span
                    className={`${primaryLine} ${selected ? selectedText : ""}`}
                    lang={code}
                    dir={getDir(code)}
                  >
                    {native}
                  </span>
                  <span
                    className={`${secondaryLine} ${selected ? selectedSubtext : ""}`}
                    lang={selected ? "en" : active}
                    dir={selected ? getDir("en") : getDir(active)}
                  >
                    {subtitle}
                  </span>
                </span>
                <span aria-hidden className={checkCell}>
                  {selected ? "✓" : ""}
                </span>
              </MenuItem>
            )
          })}
        </Menu>
        <div className={footerMessage}>Glory to Arstotzka!</div>
      </Popover>
    </MenuTrigger>
  )
}

// Main component that handles context availability
const LanguageMenu: React.FC<LanguageMenuProps> = (props) => {
  // Try to get context data, but handle gracefully if not available
  let layoutContext: any = null
  let pageState: any = null

  try {
    layoutContext = useContext(LayoutContext)
    pageState = useContext(PageContext)
  } catch (e) {
    // Contexts not available, will use props instead
  }

  return <LanguageMenuWithHook {...props} layoutContext={layoutContext} pageState={pageState} />
}

export default LanguageMenu
