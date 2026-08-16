"use client"

import "@testing-library/jest-dom"
import { render, screen } from "@testing-library/react"

import type { MyStudiesCourse } from "@/generated/api/types.generated"

import StudiesCourseCard from "../StudiesCourseCard"

// t is mocked in tests/setup-jest.js to return the key verbatim, so the counts are not in the
// rendered text; the badge's tone is compared against the neutral badge beside it.
const courseWithCompletion = (passed: boolean): MyStudiesCourse => ({
  course_id: "course-1",
  course_name: "Introduction to Programming",
  course_slug: "intro-to-programming",
  organization_slug: "uh-cs",
  language_code: "en",
  first_enrolled_at: "2025-09-03T10:00:00Z",
  // Renders the always-neutral "not current version" badge, used as the tone reference.
  is_current: false,
  hidden: false,
  current_course_instance_id: null,
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
        grade: passed ? 4 : 0,
        passed,
        prerequisite_modules_completed: true,
      },
    },
  ],
})

const badgeTones = (course: MyStudiesCourse): { modules: string; neutral: string } => {
  render(<StudiesCourseCard course={course} />)
  return {
    modules: screen.getByText("modules-completed-of-total").className,
    neutral: screen.getByText("badge-not-current-version").className,
  }
}

describe("StudiesCourseCard", () => {
  it("does not badge a module the student failed as a success", () => {
    const tones = badgeTones(courseWithCompletion(false))

    expect(tones.modules).toEqual(tones.neutral)
  })

  it("badges a module the student passed as a success", () => {
    const tones = badgeTones(courseWithCompletion(true))

    expect(tones.modules).not.toEqual(tones.neutral)
  })
})
