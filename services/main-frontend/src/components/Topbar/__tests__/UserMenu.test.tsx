"use client"

import "@testing-library/jest-dom"
import { fireEvent, render, screen } from "@testing-library/react"

import UserMenu from "../UserMenu"

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

  it("names the dialog and menu from a hidden label, not the trigger content", () => {
    render(<UserMenu />)
    const button = screen.getByRole("button", { hidden: true })
    fireEvent.click(button)
    const dialog = screen.getByRole("dialog")
    const menu = screen.getByRole("menu")
    expect(dialog.getAttribute("aria-labelledby")).not.toBe(button.id)
    expect(menu.getAttribute("aria-labelledby")).toBe(dialog.getAttribute("aria-labelledby"))
    expect(dialog).toHaveAccessibleName("Iida Saarinen. open-account-menu")
    expect(menu).toHaveAccessibleName("Iida Saarinen. open-account-menu")
  })
})
