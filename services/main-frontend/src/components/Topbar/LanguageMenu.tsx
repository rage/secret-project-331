/* eslint-disable i18next/no-literal-string */
"use client"

import { css } from "@emotion/css"
import { LanguageTranslation } from "@vectopus/atlas-icons-react"
import React, { useState } from "react"
import { Menu, MenuItem, MenuTrigger, Popover } from "react-aria-components"
import { useTranslation } from "react-i18next"

import TopBarMenuButton from "./TopBarMenuButton"

import { respondToOrLarger } from "@/shared-module/common/styles/respond"

type LanguageCode = "en" | "fi" | "sv" | "de" | "fr"

// Prefer a single source of truth for supported languages
const SUPPORTED_LANGS: LanguageCode[] = ["en", "fi", "sv", "de", "fr"]

function capitalizeFirst(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1)
}

/** Robust label getter: native (endonym), localized (in current UI lang), and English. */
function getLanguageLabels(targetCode: string, displayLocale: string) {
  // Fallbacks if Intl.DisplayNames isn't supported (older engines)
  const hasIntl = typeof Intl !== "undefined" && typeof (Intl as Intl).DisplayNames === "function"
  if (!hasIntl) {
    return {
      native: targetCode.toUpperCase(),
      localized: targetCode.toUpperCase(),
      english: targetCode.toUpperCase(),
    }
  }
  const NativeNames = new (Intl as any).DisplayNames(targetCode, { type: "language" })
  const LocalizedNames = new (Intl as any).DisplayNames(displayLocale, { type: "language" })
  const EnglishNames = new (Intl as any).DisplayNames("en", { type: "language" })
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

const LanguageMenu: React.FC = () => {
  const { i18n } = useTranslation()
  const [isOpen, setIsOpen] = useState(false)
  const current = (i18n.resolvedLanguage || i18n.language || "en").split("-")[0] // normalize
  const active = SUPPORTED_LANGS.includes(current as LanguageCode)
    ? (current as LanguageCode)
    : "en"
  const { native: activeNative } = getLanguageLabels(active, active) // button shows native name

  const changeLang = async (code: string) => {
    if (code === active) {
      return
    }
    await i18n.changeLanguage(code)
    // If you persist to URL/cookie, do it here (but keep DOM structure stable).
  }

  return (
    <MenuTrigger isOpen={isOpen} onOpenChange={setIsOpen}>
      <TopBarMenuButton
        ariaLabel={`Change language, current ${activeNative}`}
        tooltipText={`Change language, current: ${activeNative}`}
        className={triggerBtn}
      >
        <LanguageTranslation size={18} />
        {/* Always show active language name on the button */}
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
        placement="bottom end"
        offset={8}
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
          {SUPPORTED_LANGS.map((code) => {
            const { native, localized, english } = getLanguageLabels(code, active)
            const selected = code === active
            const subtitle = selected ? english : localized
            return (
              <MenuItem
                key={code}
                onAction={() => changeLang(code)}
                className={`${itemRow} ${selected ? selectedItem : ""}`}
                aria-current={selected ? "true" : undefined}
              >
                <span className={textCol}>
                  <span className={`${primaryLine} ${selected ? selectedText : ""}`}>{native}</span>
                  <span className={`${secondaryLine} ${selected ? selectedSubtext : ""}`}>
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

export default LanguageMenu
