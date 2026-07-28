"use client"

import "@testing-library/jest-dom"
import { fireEvent, render, screen } from "@testing-library/react"

import CourseCard from "../CourseCard"

// t is mocked in tests/setup-jest.js to return the translation key verbatim.
describe("CourseCard hide control", () => {
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

  it("does not render a hide button when onHide is not provided", () => {
    render(<CourseCard {...baseProps} />)

    expect(screen.queryByRole("button", { name: "hide-course" })).not.toBeInTheDocument()
  })

  it("renders a hide button and calls onHide when clicked", () => {
    const onHide = jest.fn()
    render(<CourseCard {...baseProps} onHide={onHide} />)

    fireEvent.click(screen.getByRole("button", { name: "hide-course" }))

    expect(onHide).toHaveBeenCalledTimes(1)
  })
})
