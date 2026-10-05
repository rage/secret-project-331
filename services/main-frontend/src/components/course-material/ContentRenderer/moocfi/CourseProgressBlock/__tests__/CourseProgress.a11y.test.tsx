"use client"

import "@testing-library/jest-dom"
import { fireEvent, render, screen } from "@testing-library/react"

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

const renderProgress = (overrides: Partial<UserCourseProgress> = {}) =>
  render(
    <CourseProgress
      userCourseProgress={[moduleProgress(overrides)]}
      courseInstanceLocation={location}
    />,
  )

describe("CourseProgress", () => {
  it("names the donut by its heading and the bar by what it counts", () => {
    renderProgress()
    expect(screen.getByRole("heading", { name: "course-progress" })).toBeInTheDocument()
    expect(screen.getByRole("progressbar", { name: "course-progress" })).toBeInTheDocument()
    expect(screen.getByRole("progressbar", { name: "exercises-attempted" })).toBeInTheDocument()
  })

  it("explains each chart's colours behind its ? button", async () => {
    renderProgress()
    fireEvent.click(screen.getByRole("button", { name: "label-about-points-chart" }))
    const points = await screen.findByRole("list")
    expect(points).toHaveTextContent("progress-your-points")
    expect(points).toHaveTextContent("progress-required-for-completion")
    expect(points).toHaveTextContent("progress-maximum")
    fireEvent.keyDown(document.activeElement ?? document.body, { key: "Escape" })
    fireEvent.click(screen.getByRole("button", { name: "label-about-exercises-bar" }))
    expect(await screen.findByText("progress-exercises-attempted")).toBeInTheDocument()
  })

  it("leaves the threshold out of the explanation without one", async () => {
    renderProgress({ score_required: null })
    fireEvent.click(screen.getByRole("button", { name: "label-about-points-chart" }))
    expect(await screen.findByText("progress-maximum")).toBeInTheDocument()
    expect(screen.queryByText("progress-required-for-completion")).not.toBeInTheDocument()
  })

  it("keeps the charts themselves out of the tab order", () => {
    renderProgress()
    expect(screen.getByRole("progressbar", { name: "course-progress" })).not.toHaveAttribute(
      "tabindex",
    )
    expect(screen.getByRole("progressbar", { name: "exercises-attempted" })).not.toHaveAttribute(
      "tabindex",
    )
  })

  it("offers the list of every exercise only when the course instance location is known", () => {
    const { rerender } = renderProgress()
    expect(
      screen.getByRole("button", { name: "button-show-all-exercises-in-course" }),
    ).toBeInTheDocument()
    rerender(
      <CourseProgress userCourseProgress={[moduleProgress()]} courseInstanceLocation={null} />,
    )
    expect(screen.queryByRole("button", { name: "button-show-all-exercises-in-course" })).toBeNull()
  })

  it("puts the requirements intro behind a ? next to the heading", async () => {
    renderProgress()
    expect(
      screen.getByRole("heading", { name: "heading-completion-requirements" }),
    ).toBeInTheDocument()
    expect(screen.queryByText("requirements-intro-complete-many")).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "label-about-completion-requirements" }))
    expect(await screen.findByText("requirements-intro-complete-many")).toBeInTheDocument()
    expect(screen.getByText("label-points")).toBeInTheDocument()
    expect(screen.getByText("attempted-exercises")).toBeInTheDocument()
  })

  it("words the requirements for the exam in exam courses", async () => {
    renderProgress({ requires_exam: true, score_required: null })
    expect(screen.getByRole("heading", { name: "heading-exam-requirements" })).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "label-about-exam-requirements" }))
    expect(await screen.findByText("requirements-intro-exam-one")).toBeInTheDocument()
  })

  it("leaves out the requirements without any threshold", () => {
    renderProgress({ score_required: null, attempted_exercises_required: null })
    expect(screen.queryByRole("heading", { name: /requirements/ })).not.toBeInTheDocument()
  })
})
