"use client"

import "@testing-library/jest-dom"
import { fireEvent, render, screen } from "@testing-library/react"

import LandingPageHeroSection, {
  CHAPTER_GRID_SCROLLING_DESTINATION_CLASSNAME_DOES_NOT_AFFECT_STYLING,
} from "../LandingPageHeroSection"

jest.mock("../ParsedText", () => ({
  __esModule: true,
  default: ({ text }: { text: string }) => <h1>{text}</h1>,
}))

describe("LandingPageHeroSection", () => {
  it("moves focus to the chapter grid heading when Start course is pressed", () => {
    const scrollIntoView = jest.fn()
    Element.prototype.scrollIntoView = scrollIntoView
    render(
      <>
        <LandingPageHeroSection title="Course" />
        <div className={CHAPTER_GRID_SCROLLING_DESTINATION_CLASSNAME_DOES_NOT_AFFECT_STYLING}>
          <h2>Course overview</h2>
        </div>
      </>,
    )
    fireEvent.click(screen.getByRole("button", { name: "start-course" }))
    expect(scrollIntoView).toHaveBeenCalled()
    expect(screen.getByRole("heading", { level: 2, name: "Course overview" })).toHaveFocus()
  })
})
