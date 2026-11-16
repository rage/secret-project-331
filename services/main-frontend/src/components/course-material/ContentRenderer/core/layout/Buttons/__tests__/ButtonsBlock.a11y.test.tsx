"use client"

import "@testing-library/jest-dom"
import { readFileSync } from "fs"
import { join } from "path"

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

const luminance = (hex: string) => {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  }) as [number, number, number]
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

const classCss = (element: Element) => {
  const own = Array.from(element.classList).map((c) => `.${c}`)
  return Array.from(document.styleSheets)
    .flatMap((sheet) => Array.from(sheet.cssRules))
    .filter((rule): rule is CSSStyleRule => rule instanceof CSSStyleRule)
    .filter((rule) => own.some((c) => rule.selectorText.includes(c)))
    .map((rule) => rule.cssText)
    .join("\n")
}

const contrast = (a: string, b: string) => {
  const [hi, lo] = [luminance(a), luminance(b)].toSorted((x, y) => y - x) as [number, number]
  return (hi + 0.05) / (lo + 0.05)
}

describe("ButtonsBlock variant colours (B-032)", () => {
  const tokenSource = readFileSync(
    join(process.cwd(), "src/shared-module/components/styles/tokens.ts"),
    "utf8",
  )
  const tokens = new Map(
    Array.from(tokenSource.matchAll(/(--[\w-]+):\s*([^;]+);/g), (m) => [m[1], m[2]?.trim()]),
  )
  const resolve = (name: string): string => {
    const value = tokens.get(name) ?? ""
    const ref = /^var\((--[\w-]+)\)$/.exec(value)
    return ref?.[1] ? resolve(ref[1]) : value
  }

  const variants = [
    ["primary", "is-style-material-primary-button"],
    ["secondary", "is-style-material-secondary-button"],
    ["tertiary", "is-style-material-tertiary-button"],
  ] as const

  it.each(variants)("%s button text keeps the variant foreground, also visited", (variant, cls) => {
    render(<ButtonsBlock {...makeProps({ text: "Go", url: "/x", className: cls })} />)
    const css = classCss(screen.getByRole("link", { name: "Go" }))

    // Doubled class selector out-specifies the content wrapper's `a` and `a:visited` rules.
    expect(css).toMatch(
      new RegExp(`\\.(css-\\w+)\\.\\1[^{]*\\{[^}]*color: var\\(--btn-${variant}-fg\\)`),
    )
    expect(css).toMatch(/:visited/)
  })

  it.each(variants)("%s foreground and hover pairs meet 4.5:1", (variant) => {
    const pageBackground = "#ffffff"
    const bg = resolve(`--btn-${variant}-bg`)
    const resting = contrast(
      resolve(`--btn-${variant}-fg`),
      bg.startsWith("#") ? bg : pageBackground,
    )
    const hover = contrast(
      resolve(`--btn-${variant}-fg-hover`),
      resolve(`--btn-${variant}-bg-hover`),
    )
    expect(resting).toBeGreaterThanOrEqual(4.5)
    expect(hover).toBeGreaterThanOrEqual(4.5)
  })
})
