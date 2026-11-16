"use client"

import { fireEvent, render, screen } from "@testing-library/react"

import LanguageMenu from "../LanguageMenu"

jest.mock("react-i18next", () => {
  // oxlint-disable-next-line unicorn/consistent-function-scoping -- must live inside the mock factory
  const t = (key: string) => key
  return { useTranslation: () => ({ t, i18n: { language: "en" } }) }
})

jest.mock("../hooks/useLanguageMenuItems", () => {
  const item = (code: string, label: string, isSelected: boolean) => ({
    id: `lang-${code}`,
    code,
    label,
    nativeLabel: label,
    localizedLabel: label,
    englishLabel: label,
    isSelected,
    lang: code,
    dir: "ltr",
    onSelect: jest.fn(),
  })
  return {
    useLanguageMenuItems: () => ({
      items: [item("en", "English", true), item("fi", "Suomi", false)],
      currentLanguage: "en",
      shouldShow: true,
      areLanguagesOverridden: false,
    }),
  }
})

describe("LanguageMenu", () => {
  beforeAll(() => {
    // jsdom lacks CSS.supports/escape, which the react-aria popover calls
    Object.assign(globalThis, { CSS: { supports: () => false, escape: (v: string) => v } })
  })

  it("exposes the current language as a checked radio menu item", () => {
    render(<LanguageMenu />)
    fireEvent.click(screen.getByRole("button", { hidden: true }))
    const english = screen.getByRole("menuitemradio", { name: /English/ })
    expect(english.getAttribute("aria-checked")).toBe("true")
    expect(screen.getByRole("menuitemradio", { name: /Suomi/ }).getAttribute("aria-checked")).toBe(
      "false",
    )
  })
})
