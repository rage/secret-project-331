"use client"

import "@testing-library/jest-dom"

import { fireEvent, render, screen, within } from "@testing-library/react"

import ButtonsBlock from "../ButtonsBlock"

// t is mocked in tests/setup-jest.js to return the translation key verbatim.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const makeProps = (buttonAttrs: any): any => ({
  id: "buttons-block",
  data: {
    name: "core/buttons",
    isValid: true,
    clientId: "buttons-block",
    attributes: { orientation: "horizontal" },
    innerBlocks: [
      {
        clientId: "button-1",
        name: "core/button",
        isValid: true,
        attributes: buttonAttrs,
        innerBlocks: [],
      },
    ],
  },
})

describe("ButtonsBlock accessibility (issue #69)", () => {
  it("renders each button as a single link, with no nested button element", () => {
    render(<ButtonsBlock {...makeProps({ text: "Click me", url: "https://example.com" })} />)

    const link = screen.getByRole("link", { name: "Click me" })
    expect(link.tagName).toBe("A")
    expect(link).toHaveAttribute("href", "https://example.com")
    // No <button> nested inside the link (WCAG 1.3.1: no nested interactive elements).
    expect(within(link).queryByRole("button")).not.toBeInTheDocument()
    expect(link.querySelector("button")).toBeNull()
  })

  it("keeps the opens-in-new-tab hint for target=_blank links", () => {
    render(
      <ButtonsBlock
        {...makeProps({ text: "Docs", url: "https://example.com", linkTarget: "_blank" })}
      />,
    )

    const link = screen.getByRole("link", { name: /Docs/ })
    expect(link).toHaveAttribute("target", "_blank")
    expect(link).toHaveAttribute("rel", expect.stringContaining("noopener"))
    expect(link.querySelector("button")).toBeNull()
  })

  it("disables a button whose url is not configured, so it does not link to the current page", () => {
    render(<ButtonsBlock {...makeProps({ text: "Unconfigured", url: undefined })} />)

    const control = screen.getByText("Unconfigured").closest("a")
    expect(control).not.toBeNull()
    // Exposed as disabled to assistive technology.
    expect(control).toHaveAttribute("aria-disabled", "true")
    // Clicking must not trigger a navigation (default action is prevented).
    const clickNotPrevented = fireEvent.click(control as HTMLAnchorElement)
    expect(clickNotPrevented).toBe(false)
  })
})
