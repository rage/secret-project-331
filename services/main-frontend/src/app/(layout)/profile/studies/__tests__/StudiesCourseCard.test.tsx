"use client"

import "@testing-library/jest-dom"
import { render, screen } from "@testing-library/react"

import type {
  MyCreditRegistration,
  MyStudiesCourse,
  MyStudiesCourseModule,
} from "@/generated/api/types.generated"

import StudiesCourseCard from "../StudiesCourseCard"

// t is mocked in tests/setup-jest.js to return the key verbatim, so interpolated counts are not in
// the rendered text; the modules badge's tone is compared against the neutral badge beside it.
const courseModule = (overrides: Partial<MyStudiesCourseModule>): MyStudiesCourseModule => ({
  course_module_id: "module-default",
  name: null,
  order_number: 0,
  ects_credits: 5,
  supports_credit_registration: false,
  score_given: 12,
  score_maximum: 20,
  score_required: 16,
  completion: null,
  ...overrides,
})

const course = (modules: MyStudiesCourseModule[]): MyStudiesCourse => ({
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
  modules,
})

const passedCompletion = (passed: boolean) => ({
  course_module_completion_id: "completion-1",
  completion_date: "2026-01-12T09:00:00Z",
  grade: passed ? 4 : 0,
  passed,
  prerequisite_modules_completed: true,
})

const twoModules = (passed: boolean): MyStudiesCourseModule[] => [
  courseModule({ completion: passedCompletion(passed) }),
  courseModule({ course_module_id: "module-2", name: "Part 2", order_number: 1 }),
]

const noRegistrations = new Map<string, MyCreditRegistration>()

const badgeTones = (passed: boolean): { modules: string; neutral: string } => {
  render(
    <StudiesCourseCard
      course={course(twoModules(passed))}
      registrationByCourseModuleId={noRegistrations}
    />,
  )
  return {
    modules: screen.getByText("modules-completed-of-total").className,
    neutral: screen.getByText("badge-not-current-version").className,
  }
}

describe("StudiesCourseCard", () => {
  it("shows a module's points with nothing to open first", () => {
    render(
      <StudiesCourseCard
        course={course([courseModule({})])}
        registrationByCourseModuleId={noRegistrations}
      />,
    )

    expect(screen.getByText("points-given-of-maximum")).toBeInTheDocument()
    expect(screen.queryByRole("button")).not.toBeInTheDocument()
  })

  it("does not repeat the course name as the name of its only module", () => {
    render(
      <StudiesCourseCard
        course={course([courseModule({})])}
        registrationByCourseModuleId={noRegistrations}
      />,
    )

    expect(screen.getAllByText("Introduction to Programming")).toHaveLength(1)
  })

  it("names every module of a course that has several", () => {
    render(
      <StudiesCourseCard
        course={course(twoModules(true))}
        registrationByCourseModuleId={noRegistrations}
      />,
    )

    expect(screen.getByText("Part 2")).toBeInTheDocument()
  })

  it("does not badge a module the student failed as a success", () => {
    const tones = badgeTones(false)

    expect(tones.modules).toEqual(tones.neutral)
  })

  it("badges a module the student passed as a success", () => {
    const tones = badgeTones(true)

    expect(tones.modules).not.toEqual(tones.neutral)
  })

  it("links a module's registration status to that module's own status page", () => {
    const registration = {
      course_module_id: "module-default",
      student_facing_status: "registered",
    } as MyCreditRegistration

    render(
      <StudiesCourseCard
        course={course([courseModule({ supports_credit_registration: true })])}
        registrationByCourseModuleId={new Map([["module-default", registration]])}
      />,
    )

    expect(
      screen.getByRole("link", { name: "credit-registration-status-registered" }),
    ).toHaveAttribute("href", "/completion-registration/module-default")
  })
})
