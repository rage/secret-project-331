"use client"

import "@testing-library/jest-dom"

import { render, screen } from "@testing-library/react"

import ColorsIdentifier from "../ColorsIdentifier"
import CourseProgress from "../CourseProgress"

// t is mocked in tests/setup-jest.js to return the translation key verbatim.
describe("Progress legend text values (issue #71)", () => {
  it("shows the point values as text next to the legend labels, not colour only", () => {
    render(<ColorsIdentifier studentPoints={7} requiredPoints={12} maxPoints={24} />)

    expect(screen.getByText("student-points: 7")).toBeInTheDocument()
    expect(screen.getByText("required-points: 12")).toBeInTheDocument()
    expect(screen.getByText("max-points: 24")).toBeInTheDocument()
  })

  it("omits the required-points legend when no required threshold exists", () => {
    render(<ColorsIdentifier studentPoints={7} maxPoints={24} />)

    expect(screen.getByText("student-points: 7")).toBeInTheDocument()
    expect(screen.queryByText(/required-points/)).not.toBeInTheDocument()
    expect(screen.getByText("max-points: 24")).toBeInTheDocument()
  })

  it("still renders plain labels when values are unavailable", () => {
    render(<ColorsIdentifier />)

    expect(screen.getByText("student-points")).toBeInTheDocument()
    expect(screen.getByText("max-points")).toBeInTheDocument()
  })

  it("shows the required legend without a value when a required marker is drawn elsewhere", () => {
    render(<ColorsIdentifier studentPoints={7} maxPoints={24} showRequiredLegend />)

    expect(screen.getByText("required-points")).toBeInTheDocument()
  })

  it("keeps the required legend hidden when showRequiredLegend is false and no required points exist", () => {
    render(<ColorsIdentifier studentPoints={7} maxPoints={24} showRequiredLegend={false} />)

    expect(screen.queryByText(/required-points/)).not.toBeInTheDocument()
  })
})

describe("CourseProgress legend/marker consistency", () => {
  const makeProgress = (overrides: Record<string, unknown>) => [
    {
      attempted_exercises: 3,
      attempted_exercises_required: null,
      course_module_id: "module-1",
      course_module_name: "Module 1",
      // 0 matches the initially opened accordion module, so the legend is rendered.
      course_module_order_number: 0,
      score_given: 7,
      score_maximum: 24,
      score_required: null,
      total_exercises: 10,
      ...overrides,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any,
  ]

  it("shows the required legend when only attempted_exercises_required is set (yellow marker on exercises bar)", () => {
    render(
      <CourseProgress
        userCourseProgress={makeProgress({ score_required: null, attempted_exercises_required: 5 })}
      />,
    )

    expect(screen.getByText("required-points")).toBeInTheDocument()
  })

  it("omits the required legend when neither required threshold exists", () => {
    render(
      <CourseProgress
        userCourseProgress={makeProgress({
          score_required: null,
          attempted_exercises_required: null,
        })}
      />,
    )

    expect(screen.queryByText(/required-points/)).not.toBeInTheDocument()
  })
})
