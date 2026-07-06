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

/** Collects all CSS injected into the document (emotion inserts rules via CSSOM). */
const getInjectedCss = (): string =>
  Array.from(document.styleSheets)
    .flatMap((sheet) => {
      try {
        return Array.from(sheet.cssRules).map((rule) => rule.cssText)
      } catch {
        return []
      }
    })
    .join("\n")

// t is mocked in tests/setup-jest.js to return the translation key verbatim.
describe("Hero title contrast protection (issue #74)", () => {
  it("applies a text-shadow to the HeroSection title styles for guaranteed legibility", () => {
    render(
      <HeroSection
        title="Chapter title"
        subtitle="Subtitle text"
        label="Chapter 1"
        alignCenter={false}
        backgroundImage="https://example.com/author-image.png"
      />,
    )

    expect(screen.getByRole("heading", { level: 1 })).toBeInTheDocument()
    const css = getInjectedCss()
    expect(css).toContain("text-shadow")
  })

  it("applies a text-shadow to the LandingPageHeroSection title styles", () => {
    render(
      <LandingPageHeroSection
        title="Course title"
        backgroundImage="https://example.com/author-image.png"
      >
        Subtitle
      </LandingPageHeroSection>,
    )

    expect(screen.getByRole("heading", { level: 1 })).toBeInTheDocument()
    const css = getInjectedCss()
    expect(css).toContain("text-shadow")
  })
})
