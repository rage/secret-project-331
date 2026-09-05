"use client"

import "@testing-library/jest-dom"
import { render, screen } from "@testing-library/react"

import type { MyCreditRegistration, MyStudiesCourse } from "@/generated/api/types.generated"

import StudiesCourseCard from "../StudiesCourseCard"

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
      score_given: 12,
      score_maximum: 20,
      score_required: 16,
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
      score_given: 0,
      score_maximum: null,
      completion: null,
    },
  ],
}

const renderCard = () =>
  render(
    <StudiesCourseCard
      course={course}
      registrationByCourseModuleId={new Map<string, MyCreditRegistration>()}
    />,
  )

describe("StudiesCourseCard accessibility", () => {
  it("names the course with a heading, so the card is findable out of context", () => {
    renderCard()

    expect(
      screen.getByRole("heading", { level: 3, name: "Introduction to Programming" }),
    ).toBeInTheDocument()
  })

  it("carries the result as text, not as colour alone", () => {
    renderCard()

    expect(screen.getByText("grade-n")).toBeInTheDocument()
  })

  it("spells out a module the student has not completed", () => {
    renderCard()

    expect(screen.getByText("module-not-completed-yet")).toBeInTheDocument()
  })

  it("labels the points meter and states its value in text", () => {
    renderCard()

    expect(screen.getByRole("meter")).toHaveAccessibleName("label-points")
    expect(screen.getByText("points-given-of-maximum")).toBeInTheDocument()
  })

  it("announces the modules as a list", () => {
    renderCard()

    expect(screen.getAllByRole("listitem")).toHaveLength(course.modules.length)
  })
})
