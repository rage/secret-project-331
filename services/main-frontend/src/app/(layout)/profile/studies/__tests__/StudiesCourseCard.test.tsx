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
// the rendered text.
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
  is_current: false,
  hidden: false,
  current_course_instance_id: null,
  supports_credit_registration: false,
  modules,
})

const completion = (passed: boolean) => ({
  course_module_completion_id: "completion-1",
  completion_date: "2026-01-12T09:00:00Z",
  grade: passed ? 4 : 0,
  passed,
  prerequisite_modules_completed: true,
})

const twoModules = (passed: boolean): MyStudiesCourseModule[] => [
  courseModule({ completion: completion(passed) }),
  courseModule({ course_module_id: "module-2", name: "Part 2", order_number: 1 }),
]

const noRegistrations = new Map<string, MyCreditRegistration>()

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

  it("omits the unnamed default module's name beside a named sibling, rather than repeating the course", () => {
    render(
      <StudiesCourseCard
        course={course(twoModules(true))}
        registrationByCourseModuleId={noRegistrations}
      />,
    )

    expect(screen.getAllByText("Introduction to Programming")).toHaveLength(1)
    expect(screen.getByText("Part 2")).toBeInTheDocument()
    expect(screen.queryByText("label-default-course-module")).not.toBeInTheDocument()
  })

  it("falls back to a generic module label for every row when none of them are named", () => {
    render(
      <StudiesCourseCard
        course={course([
          courseModule({}),
          courseModule({ course_module_id: "module-2", order_number: 1 }),
        ])}
        registrationByCourseModuleId={noRegistrations}
      />,
    )

    expect(screen.getAllByText("label-default-course-module")).toHaveLength(2)
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

  it("shows the module count as running text rather than a badge", () => {
    render(
      <StudiesCourseCard
        course={course(twoModules(true))}
        registrationByCourseModuleId={noRegistrations}
      />,
    )

    expect(screen.getByText(/modules-completed-of-total/)).toBeInTheDocument()
  })

  it("explains a different language version as a sentence rather than a badge", () => {
    render(
      <StudiesCourseCard
        course={course(twoModules(true))}
        registrationByCourseModuleId={noRegistrations}
      />,
    )

    expect(screen.getByText("note-course-different-language-version")).toBeInTheDocument()
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
      screen.getByRole("link", { name: "credit-registration-status-link-label" }),
    ).toHaveAttribute("href", "/completion-registration/module-default")
  })
})
