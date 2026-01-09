/* eslint-disable i18next/no-literal-string */
"use client"

import { css } from "@emotion/css"
import { LanguageTranslation } from "@vectopus/atlas-icons-react"
import React, { useState } from "react"
import { Menu, MenuItem, MenuTrigger, Popover } from "react-aria-components"
import { useTranslation } from "react-i18next"

import TopBarMenuButton from "./TopBarMenuButton"
import { useLanguageMenuItems } from "./hooks/useLanguageMenuItems"

import { getDir } from "@/shared-module/common/hooks/useLanguage"
import { respondToOrLarger } from "@/shared-module/common/styles/respond"

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
  cursor: pointer;

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
  white-space: normal;
  overflow-wrap: anywhere;
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
    layoutContext?: { courseId?: string } | null
    pageState?: { course?: { id?: string }; pageData?: { id?: string } } | null
  }
> = ({
  placement = "bottom-end",
  courseId: _propCourseId,
  currentPageId: _propCurrentPageId,
  availableLanguages: propAvailableLanguages,
  onLanguageChange: propOnLanguageChange,
  layoutContext: _layoutContext,
  pageState: _pageState,
}) => {
  const { t } = useTranslation()
  const [isOpen, setIsOpen] = useState(false)

  const { items, currentLanguage, shouldShow, areLanguagesOverridden } = useLanguageMenuItems({
    availableLanguages: propAvailableLanguages,
    onLanguageChange: propOnLanguageChange,
    onMenuClose: () => setIsOpen(false),
  })

  if (!shouldShow) {
    return null
  }

  const activeNative = items.find((item) => item.isSelected)?.nativeLabel || ""

  return (
    <MenuTrigger isOpen={isOpen} onOpenChange={setIsOpen}>
      <TopBarMenuButton
        id="topbar-language-menu"
        ariaLabel={
          areLanguagesOverridden ? t("change-course-language") : t("change-user-interface-language")
        }
        tooltipText={
          areLanguagesOverridden
            ? `${t("change-course-language")}. ${t("course-language-note")}`
            : t("change-user-interface-language")
        }
        className={triggerBtn}
        lang={currentLanguage}
        dir={getDir(currentLanguage)}
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
        lang={currentLanguage}
        dir={getDir(currentLanguage)}
        className={css`
          background: #fff;
          border: 1px solid #e5e7eb;
          border-radius: 12px;
          padding: 6px;
          min-width: 260px;
          box-shadow: 0 12px 32px rgba(0, 0, 0, 0.12);
          z-index: 999;
          max-width: 300px;
          width: 90vw;
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
          {items.map((item) => {
            const subtitle = item.isSelected ? item.englishLabel : item.localizedLabel
            return (
              <MenuItem
                key={item.id}
                onAction={item.onSelect}
                className={`${itemRow} ${item.isSelected ? selectedItem : ""}`}
                aria-current={item.isSelected ? "true" : undefined}
                lang={item.lang}
                dir={item.dir}
              >
                <span className={textCol}>
                  <span
                    className={`${primaryLine} ${item.isSelected ? selectedText : ""}`}
                    lang={item.lang}
                    dir={item.dir}
                  >
                    {item.nativeLabel}
                  </span>
                  <span
                    className={`${secondaryLine} ${item.isSelected ? selectedSubtext : ""}`}
                    lang={item.isSelected ? "en" : currentLanguage}
                    dir={item.isSelected ? getDir("en") : getDir(currentLanguage)}
                  >
                    {subtitle}
                  </span>
                </span>
                <span aria-hidden className={checkCell}>
                  {item.isSelected ? "✓" : ""}
                </span>
              </MenuItem>
            )
          })}
        </Menu>
        {areLanguagesOverridden ? (
          <div className={footerMessage}>{t("language-options-limited-to-course")}</div>
        ) : null}
      </Popover>
    </MenuTrigger>
  )
}

// Main component that handles context availability
const LanguageMenu: React.FC<LanguageMenuProps> = (props) => {
  return <LanguageMenuWithHook {...props} layoutContext={null} pageState={null} />
}

export default LanguageMenu
