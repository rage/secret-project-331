"use client"

import { fireEvent, render, screen } from "@testing-library/react"
import i18n from "i18next"
import React from "react"
import { I18nextProvider, initReactI18next } from "react-i18next"

import enSharedModule from "../../../../../locales/en/shared-module.json"
import Menu from "../Menu"

// oxlint-disable-next-line import/no-named-as-default-member
const menuI18n = i18n.createInstance()
// oxlint-disable-next-line import/no-named-as-default-member
menuI18n.use(initReactI18next).init({
  lng: "en",
  fallbackLng: "en",
  ns: ["translationsNS"],
  defaultNS: "translationsNS",
  interpolation: { escapeValue: false },
  resources: { en: { translationsNS: enSharedModule } },
})

const Wrapper: React.FC<React.PropsWithChildren> = ({ children }) => (
  <I18nextProvider i18n={menuI18n}>{children}</I18nextProvider>
)

describe("Menu", () => {
  it("uses a real button with a menu-describing accessible name", () => {
    render(
      <Menu>
        <li>Item</li>
      </Menu>,
      { wrapper: Wrapper },
    )
    const toggle = screen.getByRole("button", { name: "Navigation menu" })
    expect(toggle).toBeInTheDocument()
    expect(toggle.tagName).toBe("BUTTON")
    expect(toggle).toHaveAttribute("aria-haspopup", "menu")
  })

  it("toggles aria-expanded when clicked", () => {
    render(
      <Menu>
        <li>Item</li>
      </Menu>,
      { wrapper: Wrapper },
    )
    const toggle = screen.getByRole("button", { name: "Navigation menu" })
    expect(toggle).toHaveAttribute("aria-expanded", "false")
    fireEvent.click(toggle)
    expect(toggle).toHaveAttribute("aria-expanded", "true")
    fireEvent.click(toggle)
    expect(toggle).toHaveAttribute("aria-expanded", "false")
  })

  it("wires aria-controls to the menu list id", () => {
    render(
      <Menu>
        <li>Item</li>
      </Menu>,
      { wrapper: Wrapper },
    )
    const toggle = screen.getByRole("button", { name: "Navigation menu" })
    const controlledId = toggle.getAttribute("aria-controls")
    expect(controlledId).toBeTruthy()
    // useId produces ids containing colons that are invalid CSS selectors, so getElementById is required here.
    // oxlint-disable-next-line unicorn/prefer-query-selector
    const list = document.getElementById(controlledId as string)
    expect(list?.tagName).toBe("UL")
    expect(list).toContainElement(screen.getByText("Item"))
  })
})
