"use client"

import "@testing-library/jest-dom"
import { render, screen } from "@testing-library/react"
import React from "react"

import HeroSection from "../HeroSection"
import LandingPageHeroSection from "../LandingPageHeroSection"

// ParsedText pulls in glossary context and portals; substitute a plain tag render.
jest.mock("../ParsedText", () => ({
  __esModule: true,
  default: ({
    text,
    tag,
    tagProps,
  }: {
    text: string
    tag: string
    tagProps?: Record<string, unknown>
  }) => {
    const Tag = tag as keyof React.JSX.IntrinsicElements
    return <Tag {...tagProps}>{text}</Tag>
  },
}))

const AUTHOR_BACKGROUND_IMAGE = "https://example.com/author-image.png"

/** The readability shadow itself, so that the `text-shadow: none` of a plain hero does not match. */
const READABILITY_SHADOW = /text-shadow:\s*0 1px 2px/

/**
 * The CSS emotion injected for one element's own classes, media-query blocks included. Rules from
 * earlier renders stay in the document, so reading every stylesheet cannot tell the heroes apart.
 */
const cssForElement = (element: Element): string => {
  const ownSelectors = Array.from(element.classList).map(
    (className) => new RegExp(`\\.${className}(?![\\w-])`),
  )
  const collect = (rules: CSSRuleList): string[] =>
    Array.from(rules).flatMap((rule) => {
      if (rule instanceof CSSMediaRule) {
        return collect(rule.cssRules)
      }
      if (rule instanceof CSSStyleRule && ownSelectors.some((own) => own.test(rule.selectorText))) {
        return [rule.cssText]
      }
      return []
    })

  return Array.from(document.styleSheets)
    .flatMap((sheet) => {
      try {
        return collect(sheet.cssRules)
      } catch {
        return []
      }
    })
    .join("\n")
}

/** The styled container both heroes put the readability shadow on; the title inherits it. */
const renderedHeroTextBox = (): Element => {
  const heading = screen.getByRole("heading", { level: 1 })
  const textBox = heading.parentElement
  if (textBox === null) {
    throw new Error("Hero heading rendered outside a text box")
  }
  return textBox
}

// t is mocked in tests/setup-jest.js to return the translation key verbatim.
describe("Hero title contrast protection (issue #74)", () => {
  it("applies a text-shadow to the HeroSection title styles for guaranteed legibility", () => {
    render(
      <HeroSection
        title="Chapter title"
        subtitle="Subtitle text"
        label="Chapter 1"
        alignCenter={false}
        backgroundImage={AUTHOR_BACKGROUND_IMAGE}
      />,
    )

    expect(screen.getByRole("heading", { level: 1 })).toBeInTheDocument()
    expect(cssForElement(renderedHeroTextBox())).toMatch(READABILITY_SHADOW)
  })

  it("applies a text-shadow to the LandingPageHeroSection title styles", () => {
    render(
      <LandingPageHeroSection title="Course title" backgroundImage={AUTHOR_BACKGROUND_IMAGE}>
        Subtitle
      </LandingPageHeroSection>,
    )

    expect(screen.getByRole("heading", { level: 1 })).toBeInTheDocument()
    expect(cssForElement(renderedHeroTextBox())).toMatch(READABILITY_SHADOW)
  })

  it("leaves HeroSection text unshadowed when no background image resolved", () => {
    render(
      <HeroSection
        title="Chapter title"
        subtitle="Subtitle text"
        label="Chapter 1"
        alignCenter={false}
      />,
    )

    expect(cssForElement(renderedHeroTextBox())).not.toMatch(READABILITY_SHADOW)
  })

  it("leaves LandingPageHeroSection text unshadowed when no background image resolved", () => {
    render(<LandingPageHeroSection title="Course title">Subtitle</LandingPageHeroSection>)

    expect(cssForElement(renderedHeroTextBox())).not.toMatch(READABILITY_SHADOW)
  })
})
