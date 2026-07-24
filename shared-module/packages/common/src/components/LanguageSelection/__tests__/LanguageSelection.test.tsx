"use client"

import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import React from "react"
import { I18nextProvider } from "react-i18next"

import i18nTest from "../../../utils/testing/i18nTest"
import LanguageSelection from "../index"

// @vectopus/atlas-icons-react ships an ESM build that jest's transformIgnorePatterns
// does not cover, so it fails to parse unless mocked out in tests.
jest.mock("@vectopus/atlas-icons-react", () => ({
  LanguageTranslation: () => null,
}))

const Wrapper: React.FC<React.PropsWithChildren> = ({ children }) => (
  <I18nextProvider i18n={i18nTest}>{children}</I18nextProvider>
)

describe("LanguageSelection", () => {
  it("exposes its expanded state via aria-expanded on the toggle button", async () => {
    render(<LanguageSelection placement="bottom" />, { wrapper: Wrapper })
    const toggle = screen.getByRole("button")

    // The popup is a plain popper list (no role="menu"/menuitem, no menu keyboard
    // pattern), so aria-haspopup="menu" must not be set.
    expect(toggle).not.toHaveAttribute("aria-haspopup")
    expect(toggle).toHaveAttribute("aria-expanded", "false")

    fireEvent.click(toggle)
    await waitFor(() => expect(toggle).toHaveAttribute("aria-expanded", "true"))

    fireEvent.click(toggle)
    await waitFor(() => expect(toggle).toHaveAttribute("aria-expanded", "false"))
  })
})
