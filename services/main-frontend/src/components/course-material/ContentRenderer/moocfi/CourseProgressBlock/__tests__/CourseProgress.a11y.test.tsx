"use client"

import "@testing-library/jest-dom"
import { render, screen } from "@testing-library/react"

import type { UserCourseProgress } from "@/generated/course-material-api/types.generated"

import CourseProgress from "../CourseProgress"

// t is mocked in tests/setup-jest.js to return the translation key verbatim.
const moduleProgress = (overrides: Partial<UserCourseProgress> = {}): UserCourseProgress => ({
  course_module_id: "module-1",
  course_module_name: "Module 1",
  // 0 matches the initially opened accordion module, so its card is rendered.
  course_module_order_number: 0,
  score_given: 7,
  score_maximum: 24,
  score_required: 12,
  total_exercises: 10,
  attempted_exercises: 3,
  attempted_exercises_required: 5,
  automatic_completion: true,
  requires_exam: false,
  ...overrides,
})

const location = { courseInstanceId: "instance-1", organizationSlug: "uh-cs", courseSlug: "basics" }

describe("CourseProgress", () => {
  it("gives each chart its own progressbar and the module's requirements their own region", () => {
    render(
      <CourseProgress userCourseProgress={[moduleProgress()]} courseInstanceLocation={location} />,
    )

    expect(screen.getByRole("progressbar", { name: "label-points" })).toBeInTheDocument()
    expect(screen.getByRole("progressbar", { name: "exercises-attempted" })).toBeInTheDocument()
    expect(
      screen.getByRole("region", { name: "label-completion-requirements-for-module" }),
    ).toBeInTheDocument()
    expect(screen.getAllByRole("listitem")).toHaveLength(2)
  })

  it("offers the points by exercise only when the course instance location is known", () => {
    const { rerender } = render(
      <CourseProgress userCourseProgress={[moduleProgress()]} courseInstanceLocation={location} />,
    )
    expect(
      screen.getByRole("button", { name: "button-show-all-exercises-in-course" }),
    ).toBeInTheDocument()
    rerender(
      <CourseProgress userCourseProgress={[moduleProgress()]} courseInstanceLocation={null} />,
    )
    expect(screen.queryByRole("button", { name: "button-show-all-exercises-in-course" })).toBeNull()
  })

  it("switches to exam wording when the module requires an exam", () => {
    render(
      <CourseProgress
        userCourseProgress={[moduleProgress({ requires_exam: true })]}
        courseInstanceLocation={location}
      />,
    )

    expect(screen.getByRole("heading", { name: "heading-exam-requirements" })).toBeInTheDocument()
    expect(screen.getByText("requirements-exam-pending")).toBeInTheDocument()
  })

  it("shows the teacher note instead of thresholds for manual completion", () => {
    render(
      <CourseProgress
        userCourseProgress={[
          moduleProgress({
            automatic_completion: false,
            score_required: null,
            attempted_exercises_required: null,
          }),
        ]}
        courseInstanceLocation={location}
      />,
    )

    expect(screen.queryByRole("list")).not.toBeInTheDocument()
    expect(screen.getByText("note-graded-by-your-teacher")).toBeInTheDocument()
  })
})
