"use client"

import "@testing-library/jest-dom"
import { render, screen } from "@testing-library/react"

import type { MyStudiesCourse } from "@/generated/api/types.generated"

import CourseCompletionsTable from "../CourseCompletionsTable"

// t is mocked in tests/setup-jest.js to return the translation key verbatim.
const course: MyStudiesCourse = {
  course_id: "course-1",
  course_name: "Introduction to Programming",
  course_slug: "intro-to-programming",
  organization_slug: "uh-cs",
  language_code: "en",
  first_enrolled_at: "2025-09-03T10:00:00Z",
  is_current: true,
  hidden: false,
  supports_credit_registration: false,
  modules: [
    {
      course_module_id: "module-default",
      name: null,
      order_number: 0,
      ects_credits: 5,
      supports_credit_registration: false,
      completion: {
        course_module_completion_id: "completion-1",
        completion_date: "2026-01-12T09:00:00Z",
        grade: 4,
        passed: true,
        prerequisite_modules_completed: true,
      },
    },
    {
      course_module_id: "module-2",
      name: "Part 2",
      order_number: 1,
      ects_credits: null,
      supports_credit_registration: false,
      completion: null,
    },
  ],
}

describe("CourseCompletionsTable accessibility", () => {
  it("names the table with a caption so the course is identifiable out of context", () => {
    render(<CourseCompletionsTable course={course} />)

    expect(screen.getByRole("table")).toHaveAccessibleName("completions-in-course")
  })

  it("labels every column with a real column header", () => {
    render(<CourseCompletionsTable course={course} />)

    expect(screen.getByRole("columnheader", { name: "label-module" })).toBeInTheDocument()
    expect(screen.getByRole("columnheader", { name: "label-grade" })).toBeInTheDocument()
    expect(screen.getByRole("columnheader", { name: "label-completed" })).toBeInTheDocument()
    expect(screen.getByRole("columnheader", { name: "label-ects-credits" })).toBeInTheDocument()
  })

  it("labels the default module with the course name rather than leaving the cell blank", () => {
    render(<CourseCompletionsTable course={course} />)

    expect(screen.getByRole("cell", { name: "Introduction to Programming" })).toBeInTheDocument()
  })

  it("carries the result as text, not as colour alone", () => {
    render(<CourseCompletionsTable course={course} />)

    expect(screen.getByRole("cell", { name: "4" })).toBeInTheDocument()
  })

  it("lists a module the student has not completed, with its empty values spelled out", () => {
    render(<CourseCompletionsTable course={course} />)

    const notCompletedRow = screen.getByRole("row", { name: /Part 2/ })
    expect(notCompletedRow).toHaveTextContent("—")
  })
})
