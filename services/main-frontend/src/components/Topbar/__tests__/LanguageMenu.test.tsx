"use client"

import "@testing-library/jest-dom"
import { fireEvent, render, screen } from "@testing-library/react"

import LanguageMenu from "../LanguageMenu"

const mockItem = (code: string, label: string, isSelected: boolean) => ({
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

jest.mock("../hooks/useLanguageMenuItems", () => {
  return {
    useLanguageMenuItems: () => ({
      items: [mockItem("en", "English", true), mockItem("fi", "Suomi", false)],
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

  it("hides the decorative icon and names the button and popup without SVG text", () => {
    render(<LanguageMenu />)
    const button = screen.getByRole("button", { hidden: true })
    const svg = button.querySelector("svg[aria-hidden='true']")
    expect(svg).not.toBeNull()
    expect(button.getAttribute("aria-label")).toBe("English. change-user-interface-language")
    fireEvent.click(button)
    expect(
      screen.getByRole("dialog", { name: "English. change-user-interface-language" }),
    ).toBeTruthy()
  })

  it("names the dialog and menu from a hidden label, not the trigger content", () => {
    render(<LanguageMenu />)
    const button = screen.getByRole("button", { hidden: true })
    fireEvent.click(button)
    const dialog = screen.getByRole("dialog")
    const menu = screen.getByRole("menu")
    expect(dialog.getAttribute("aria-labelledby")).not.toBe(button.id)
    expect(menu.getAttribute("aria-labelledby")).toBe(dialog.getAttribute("aria-labelledby"))
    expect(dialog).toHaveAccessibleName("English. change-user-interface-language")
    expect(menu).toHaveAccessibleName("English. change-user-interface-language")
  })
})
