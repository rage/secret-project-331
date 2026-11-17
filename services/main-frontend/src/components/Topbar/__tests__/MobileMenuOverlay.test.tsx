"use client"

import "@testing-library/jest-dom"
import { useOverlayTriggerState } from "@react-stately/overlays"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"

import { MobileMenuOverlay } from "../MobileMenu/MobileMenuOverlay"

jest.mock("react-i18next", () => {
  // oxlint-disable-next-line unicorn/consistent-function-scoping -- must live inside the mock factory
  const t = (key: string) => key
  return { useTranslation: () => ({ t, i18n: { language: "en" } }) }
})

jest.mock("../hooks/useLanguageMenuItems", () => ({
  useLanguageMenuItems: () => ({
    items: [
      {
        id: "lang-en",
        code: "en",
        label: "English",
        nativeLabel: "English",
        isSelected: true,
        lang: "en",
        dir: "ltr",
        onSelect: jest.fn(),
      },
      {
        id: "lang-fi",
        code: "fi",
        label: "Suomi",
        nativeLabel: "Suomi",
        isSelected: false,
        lang: "fi",
        dir: "ltr",
        onSelect: jest.fn(),
      },
    ],
    currentLanguage: "en",
    shouldShow: true,
    areLanguagesOverridden: false,
  }),
}))
jest.mock("../hooks/useUserMenuItems", () => ({
  useUserMenuItems: () => ({ items: [], shouldShow: false }),
}))
jest.mock("../hooks/useQuickActionsItems", () => ({
  useQuickActionsItems: () => ({ items: [], shouldShow: false }),
}))

const state = {
  isOpen: true,
  close: jest.fn(),
  open: jest.fn(),
  toggle: jest.fn(),
  setOpen: jest.fn(),
}

function Harness() {
  const menuState = useOverlayTriggerState({})
  return (
    <>
      <button type="button" onClick={menuState.open}>
        Open menu
      </button>
      {menuState.isOpen && <MobileMenuOverlay state={menuState} onClose={menuState.close} />}
    </>
  )
}

describe("MobileMenuOverlay", () => {
  it("labels the close button 'close-menu' and has a single heading", () => {
    render(<MobileMenuOverlay state={state as never} />)
    expect(screen.getByRole("button", { name: "close-menu" })).toBeInTheDocument()
    expect(screen.getAllByRole("heading", { hidden: true })).toHaveLength(1)
  })

  it("moves focus into the language submenu and back to its parent item", () => {
    render(<MobileMenuOverlay state={state as never} />)
    const parent = screen.getByRole("button", { name: "English" })
    fireEvent.click(parent)
    const back = document.querySelector<HTMLElement>("[data-submenu-back]")
    expect(back).not.toBeNull()
    expect(back).toHaveFocus()
    fireEvent.click(back as HTMLElement)
    expect(screen.getByRole("button", { name: "English" })).toHaveFocus()
  })

  it("returns focus to the menu button when Escape closes the menu", async () => {
    render(<Harness />)
    const opener = screen.getByRole("button", { name: "Open menu" })
    opener.focus()
    fireEvent.click(opener)
    await waitFor(() =>
      expect(screen.getByRole("dialog")).toContainElement(document.activeElement as HTMLElement),
    )
    fireEvent.keyDown(document.activeElement as HTMLElement, { key: "Escape" })
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument())
    await waitFor(() => expect(opener).toHaveFocus())
  })
})
