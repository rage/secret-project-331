"use client"

import { fireEvent, render, screen } from "@testing-library/react"

import UserMenu from "../UserMenu"

jest.mock("react-i18next", () => {
  // oxlint-disable-next-line unicorn/consistent-function-scoping -- must live inside the mock factory
  const t = (key: string) => key
  return { useTranslation: () => ({ t, i18n: { language: "en" } }) }
})

jest.mock("../hooks/useUserMenuItems", () => ({
  useUserMenuItems: () => ({
    items: [],
    displayName: "Iida Saarinen",
    displayInitial: "I",
    displayEmail: "iida@example.com",
    fullDisplayName: "Iida Saarinen",
    shouldShow: true,
  }),
}))

describe("UserMenu", () => {
  beforeAll(() => {
    Object.assign(globalThis, { CSS: { supports: () => false, escape: (v: string) => v } })
  })

  it("hides the avatar initial and names the button and popup without it", () => {
    render(<UserMenu />)
    const button = screen.getByRole("button", { hidden: true })
    expect(button.querySelector("[data-initial='I']")?.getAttribute("aria-hidden")).toBe("true")
    expect(button.getAttribute("aria-label")).toBe("Iida Saarinen. open-account-menu")
    fireEvent.click(button)
    expect(screen.getByRole("dialog", { name: "Iida Saarinen. open-account-menu" })).toBeTruthy()
  })
})
