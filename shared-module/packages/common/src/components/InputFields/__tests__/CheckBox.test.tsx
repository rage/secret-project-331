"use client"

import "@testing-library/jest-dom"

import { render } from "@testing-library/react"

import { baseTheme } from "../../../styles"
import CheckBox from "../CheckBox"

/**
 * Collects the text of every emotion-injected <style> tag so we can assert on
 * the generated CSS rules (emotion serializes styles into stylesheets in jsdom).
 */
const collectInjectedCss = (): string => {
  // Emotion inserts rules via CSSOM insertRule in the test environment, so the
  // <style> textContent is empty and we must read the parsed stylesheet rules.
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

    // The old fill #37bc9b gave a ~2.3:1 white tick and must be gone.
    expect(injectedCss).not.toContain("#37bc9b")

    // The new fill is green-600 (#1F6964), which gives the white tick ~5.7:1.
    expect(baseTheme.colors.green[600].toLowerCase()).toBe("#1f6964")
    expect(injectedCss).toContain(baseTheme.colors.green[600].toLowerCase())
  })

  it("renders the checkbox input", () => {
    const { getByRole } = render(<CheckBox label="I agree" checked readOnly />)
    expect(getByRole("checkbox")).toBeInTheDocument()
  })
})
