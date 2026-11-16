"use client"

import "@testing-library/jest-dom"
import { render, screen } from "@testing-library/react"
import React from "react"

import { heroTextReadabilityCss, relativeLuminance } from "../heroBackgroundImages"
import HeroSection from "../HeroSection"
import LandingPageHeroSection from "../LandingPageHeroSection"

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

const IMAGE = "https://example.com/bg.png"
const DARK_HALO = /rgba\(0, 0, 0, 0\.55\)/
const LIGHT_HALO = /rgba\(255, 255, 255, 0\.55\)/

describe("hero text halo follows text luminance (B-037)", () => {
  it("uses a light halo for dark text and a dark halo for light text", () => {
    expect(heroTextReadabilityCss(IMAGE, "#1a2333")).toMatch(LIGHT_HALO)
    expect(heroTextReadabilityCss(IMAGE, "#000")).toMatch(LIGHT_HALO)
    expect(heroTextReadabilityCss(IMAGE, "#ffffff")).toMatch(DARK_HALO)
    expect(heroTextReadabilityCss(IMAGE, "rgb(250, 250, 250)")).toMatch(DARK_HALO)
  })

  it("uses the default dark text colour when none is set and keeps a dark halo when unparseable", () => {
    expect(heroTextReadabilityCss(IMAGE)).toMatch(LIGHT_HALO)
    expect(heroTextReadabilityCss(IMAGE, "papayawhip")).toMatch(DARK_HALO)
  })

  it("adds no shadow without a background image", () => {
    expect(heroTextReadabilityCss(undefined, "#fff")).toMatch(/text-shadow:\s*none/)
  })

  it("parses luminance", () => {
    expect(relativeLuminance("#ffffff")).toBeCloseTo(1)
    expect(relativeLuminance("#000000")).toBeCloseTo(0)
    expect(relativeLuminance("nope")).toBeUndefined()
  })
})

describe("hero title level inside an exam", () => {
  it("exposes the hero title as level 2 when isExam", () => {
    render(<HeroSection title="T" subtitle="s" alignCenter={false} isExam />)
    expect(screen.getByRole("heading", { level: 2, name: "T" })).toBeInTheDocument()
    expect(screen.queryByRole("heading", { level: 1 })).toBeNull()
  })

  it("keeps level 1 outside exams", () => {
    render(<HeroSection title="T" subtitle="s" alignCenter={false} />)
    expect(screen.getByRole("heading", { level: 1, name: "T" })).toBeInTheDocument()
  })

  it("applies the same to the landing page hero", () => {
    render(
      <LandingPageHeroSection title="L" isExam>
        x
      </LandingPageHeroSection>,
    )
    expect(screen.getByRole("heading", { level: 2, name: "L" })).toBeInTheDocument()
  })
})
