"use client"

import "@testing-library/jest-dom"
import { render } from "@testing-library/react"

import { baseTheme } from "../../../styles"
import CheckBox from "../CheckBox"

// jsdom leaves <style> textContent empty since emotion inserts rules via CSSOM,
// so we read the parsed stylesheet rules instead.
const collectInjectedCss = (): string => {
  const fromRules = Array.from(document.styleSheets)
    .flatMap((sheet) => {
      try {
        return Array.from(sheet.cssRules).map((rule) => rule.cssText)
      } catch {
        return []
      }
    })
    .join("\n")
  const fromTextContent = Array.from(document.querySelectorAll("style"))
    .map((styleTag) => styleTag.textContent ?? "")
    .join("\n")
  return `${fromRules}\n${fromTextContent}`
}

describe("CheckBox contrast (accessibility issue #46)", () => {
  it("fills the selected checkbox with the dark design-system green (green-600), not the old low-contrast teal", () => {
    render(<CheckBox label="I agree" checked readOnly />)

    const injectedCss = collectInjectedCss().toLowerCase()

    expect(injectedCss).not.toContain("#37bc9b")

    expect(baseTheme.colors.green[600].toLowerCase()).toBe("#1f6964")
    expect(injectedCss).toContain(baseTheme.colors.green[600].toLowerCase())
  })

  it("renders the checkbox input", () => {
    const { getByRole } = render(<CheckBox label="I agree" checked readOnly />)
    expect(getByRole("checkbox")).toBeInTheDocument()
  })
})
