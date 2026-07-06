"use client"

import "@testing-library/jest-dom"

import { render, screen, within } from "@testing-library/react"

import CongratulationsLinks from "../CongratulationsLinks"

import type { UserModuleCompletionStatus } from "@/generated/course-material-api/types.generated"

// t is mocked in tests/setup-jest.js to return the translation key verbatim.
const baseModule: UserModuleCompletionStatus = {
  certificate_configuration_id: "ccid-1",
  certification_enabled: true,
  completed: true,
  default: false,
  enable_registering_completion_to_uh_open_university: true,
  grade: 5,
  module_id: "module-1",
  name: "Introduction",
  order_number: 1,
  passed: true,
  prerequisite_modules_completed: true,
}

describe("CongratulationsLinks accessibility (issue #55)", () => {
  it("renders each CTA as a single interactive element (no anchor wrapping a button)", () => {
    render(<CongratulationsLinks certificateConfigurationId="ccid-1" module={baseModule} />)

    const links = screen.getAllByRole("link")
    // Register + generate-certificate = two links, none containing a nested button.
    expect(links).toHaveLength(2)
    links.forEach((link) => {
      expect(within(link).queryByRole("button")).not.toBeInTheDocument()
      expect(link.querySelector("button")).toBeNull()
      // No button ancestor either.
      expect(link.closest("button")).toBeNull()
    })
  })

  it("uses the visible label as the accessible name (no overriding aria-label)", () => {
    render(<CongratulationsLinks certificateConfigurationId="ccid-1" module={baseModule} />)

    // The accessible name comes from the visible text, not a hardcoded English aria-label.
    const certificateLink = screen.getByRole("link", {
      name: "generate-certificate-button-label",
    })
    expect(certificateLink).toHaveAttribute(
      "href",
      expect.stringContaining("/generate-certificate"),
    )
    expect(certificateLink).not.toHaveAttribute("aria-label")

    const registerLink = screen.getByRole("link", { name: "register" })
    expect(registerLink).not.toHaveAttribute("aria-label")
  })

  it("renders a disabled button (not a navigable link) when the module is not completed", () => {
    render(
      <CongratulationsLinks
        certificateConfigurationId="ccid-1"
        module={{ ...baseModule, completed: false }}
      />,
    )

    // No links when incomplete, and the CTAs are disabled buttons instead.
    expect(screen.queryByRole("link")).not.toBeInTheDocument()
    const buttons = screen.getAllByRole("button")
    expect(buttons).toHaveLength(2)
    buttons.forEach((button) => expect(button).toBeDisabled())
  })
})
