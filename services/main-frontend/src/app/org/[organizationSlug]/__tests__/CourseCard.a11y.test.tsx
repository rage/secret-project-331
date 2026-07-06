"use client"

import "@testing-library/jest-dom"

import { render, screen } from "@testing-library/react"

import CourseCard from "../CourseCard"

// t is mocked in tests/setup-jest.js to return the translation key verbatim.
describe("CourseCard accessibility (issue #60)", () => {
  const baseProps = {
    title: "Introduction to Programming",
    isDraft: false,
    isUnlisted: false,
    description: "Learn the basics of programming.",
    languageCode: "en-US",
    manageHref: "/manage/courses/course-1",
    navigateToCourseHref: "/org/test/courses/course-1",
    id: "course-1",
    showManageButton: false,
  }

  it("uses the visible heading text as the link's accessible name (no aria-label override)", () => {
    render(<CourseCard {...baseProps} />)

    const link = screen.getByRole("link", { name: /Introduction to Programming/ })
    expect(link).not.toHaveAttribute("aria-label")
    expect(link).toHaveAttribute("href", baseProps.navigateToCourseHref)
  })

  it("includes the draft suffix in the accessible name so it matches the visible text", () => {
    render(<CourseCard {...baseProps} isDraft={true} />)

    // The visible heading shows "(draft)"; the accessible name must include it too
    // now that no aria-label overrides the visible text (WCAG 2.5.3).
    const link = screen.getByRole("link")
    expect(link).toHaveAccessibleName(expect.stringContaining("Introduction to Programming"))
    expect(link).toHaveAccessibleName(expect.stringContaining("draft"))
  })

  it("keeps the course description and language outside the link's accessible name", () => {
    render(<CourseCard {...baseProps} />)

    const link = screen.getByRole("link")
    expect(link).not.toHaveAccessibleName(expect.stringContaining("Learn the basics"))
    // Description and language remain exposed as normal page text.
    expect(screen.getByText("Learn the basics of programming.")).toBeInTheDocument()
  })
})
