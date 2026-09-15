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
  total_exercises: 10,
  attempted_exercises: 6,
  attempted_exercises_required: 8,
  automatic_completion: true,
  requires_exam: false,
  completion: null,
  ...overrides,
})

const course = (
  modules: MyStudiesCourseModule[],
  overrides: Partial<MyStudiesCourse> = {},
): MyStudiesCourse => ({
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
  exam_passed: null,
  modules,
  ...overrides,
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
  courseModule({ course_module_id: "module-2", name: "Extra module", order_number: 1 }),
]

const teacherGradedModule = (overrides: Partial<MyStudiesCourseModule>): MyStudiesCourseModule =>
  courseModule({
    automatic_completion: false,
    score_required: null,
    attempted_exercises_required: null,
    ...overrides,
  })

const noRegistrations = new Map<string, MyCreditRegistration>()

describe("StudiesCourseCard", () => {
  it("shows a module's points with nothing to open first", () => {
    render(
      <StudiesCourseCard
        course={course([courseModule({})])}
        registrationByCourseModuleId={noRegistrations}
      />,
    )

    expect(screen.getAllByRole("meter")).toHaveLength(2)
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

  it("titles the default module's row with the course name, because that module is the course", () => {
    render(
      <StudiesCourseCard
        course={course(twoModules(true))}
        registrationByCourseModuleId={noRegistrations}
      />,
    )

    expect(
      screen.getByRole("heading", { level: 4, name: "Introduction to Programming" }),
    ).toBeInTheDocument()
    expect(screen.getByRole("heading", { level: 4, name: "Extra module" })).toBeInTheDocument()
  })

  it("asks for the course on the default module's row and for a module on the others", () => {
    render(
      <StudiesCourseCard
        course={course([
          courseModule({}),
          courseModule({ course_module_id: "module-2", name: "Extra module", order_number: 1 }),
        ])}
        registrationByCourseModuleId={noRegistrations}
      />,
    )

    expect(screen.getByText("x-to-complete-this-course")).toBeInTheDocument()
    expect(screen.getByText("x-to-complete-this-module")).toBeInTheDocument()
  })

  it("names every module of a course that has several", () => {
    render(
      <StudiesCourseCard
        course={course(twoModules(true))}
        registrationByCourseModuleId={noRegistrations}
      />,
    )

    expect(screen.getByText("Extra module")).toBeInTheDocument()
  })

  it("shows the module count as running text rather than a badge", () => {
    render(
      <StudiesCourseCard
        course={course(twoModules(true))}
        registrationByCourseModuleId={noRegistrations}
      />,
    )

    expect(screen.getByText(/completed-of-total/)).toBeInTheDocument()
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

  it("leads with what is still missing rather than with the raw fractions", () => {
    render(
      <StudiesCourseCard
        course={course([courseModule({})])}
        registrationByCourseModuleId={noRegistrations}
      />,
    )

    expect(screen.getByText("x-to-complete-this-course")).toBeInTheDocument()
    expect(screen.getAllByText("value-of-maximum")).toHaveLength(2)
  })

  it("calls a module whose thresholds are all met met, rather than not completed yet", () => {
    render(
      <StudiesCourseCard
        course={course([courseModule({ score_given: 20, attempted_exercises: 10 })])}
        registrationByCourseModuleId={noRegistrations}
      />,
    )

    expect(screen.getByText("label-requirements-met")).toBeInTheDocument()
    expect(screen.queryByText("x-to-complete-this-course")).not.toBeInTheDocument()
  })

  it("bars both dimensions of a measured module, even the one no threshold marks", () => {
    render(
      <StudiesCourseCard
        course={course([courseModule({ attempted_exercises_required: null })])}
        registrationByCourseModuleId={noRegistrations}
      />,
    )

    expect(screen.getAllByRole("meter")).toHaveLength(2)
    expect(screen.getAllByText("value-of-maximum")).toHaveLength(2)
  })

  it("states a module a teacher decides as bare figures, since no threshold judges them", () => {
    render(
      <StudiesCourseCard
        course={course([teacherGradedModule({})])}
        registrationByCourseModuleId={noRegistrations}
      />,
    )

    expect(screen.queryAllByRole("meter")).toHaveLength(0)
    expect(screen.getAllByText("value-of-maximum")).toHaveLength(2)
  })

  it("says the thresholds admit the student to an exam when one stands between them and the completion", () => {
    render(
      <StudiesCourseCard
        course={course([courseModule({ requires_exam: true })], { exam_passed: false })}
        registrationByCourseModuleId={noRegistrations}
      />,
    )

    expect(screen.getByText("x-to-take-the-exam")).toBeInTheDocument()
    expect(screen.getByRole("group", { name: "heading-to-take-the-exam" })).toBeInTheDocument()
    expect(screen.getByText("label-exam")).toBeInTheDocument()
    expect(screen.getByText("label-not-passed")).toBeInTheDocument()
  })

  it("offers no threshold for a module a teacher grades, since nothing measures one", () => {
    render(
      <StudiesCourseCard
        course={course([teacherGradedModule({})])}
        registrationByCourseModuleId={noRegistrations}
      />,
    )

    expect(screen.getByText(/note-graded-by-your-teacher/)).toBeInTheDocument()
    expect(screen.queryByRole("meter")).not.toBeInTheDocument()
  })

  it("says a whole teacher-graded course is one once, not under each of its modules", () => {
    render(
      <StudiesCourseCard
        course={course([
          teacherGradedModule({}),
          teacherGradedModule({
            course_module_id: "module-2",
            name: "Extra module",
            order_number: 1,
          }),
        ])}
        registrationByCourseModuleId={noRegistrations}
      />,
    )

    expect(screen.getAllByText(/note-graded-by-your-teacher/)).toHaveLength(1)
  })

  it("names the teacher-graded module of a course whose others complete on their own", () => {
    render(
      <StudiesCourseCard
        course={course([
          teacherGradedModule({}),
          courseModule({ course_module_id: "module-2", name: "Extra module", order_number: 1 }),
        ])}
        registrationByCourseModuleId={noRegistrations}
      />,
    )

    // Once per card either way; here it belongs to the one module it is true of, not the header.
    const teacherNote = screen.getByText("note-graded-by-your-teacher")
    const [teacherGradedPart] = screen.getAllByRole("listitem")
    expect(teacherGradedPart).toContainElement(teacherNote)
  })

  it("drops the requirements of a module the student has completed", () => {
    render(
      <StudiesCourseCard
        course={course([courseModule({ completion: completion(true) })])}
        registrationByCourseModuleId={noRegistrations}
      />,
    )

    expect(screen.queryByText("x-to-complete-this-course")).not.toBeInTheDocument()
    expect(screen.queryByRole("meter")).not.toBeInTheDocument()
  })
})
