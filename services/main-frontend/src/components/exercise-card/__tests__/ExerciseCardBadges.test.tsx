"use client"

import "@testing-library/jest-dom"
import { render, screen } from "@testing-library/react"

import ExerciseCardPointsBadge from "../ExerciseCardPointsBadge"
import ExerciseCardTriesBadge from "../ExerciseCardTriesBadge"

// react-i18next is mocked in tests/setup-jest.js, so t() returns the translation key.
describe("ExerciseCardTriesBadge accessibility", () => {
  it("hides the decorative icon from assistive technology (WCAG 1.1.1)", () => {
    const { container } = render(<ExerciseCardTriesBadge triesRemaining={2} />)
    const svg = container.querySelector("svg")
    expect(svg).not.toBeNull()
    expect(svg?.closest('[aria-hidden="true"]')).not.toBeNull()
  })

  it("still shows the tries label and count as text", () => {
    render(<ExerciseCardTriesBadge triesRemaining={2} />)
    expect(screen.getByText("tries")).toBeInTheDocument()
    expect(screen.getByText("2")).toBeInTheDocument()
  })
})

describe("ExerciseCardPointsBadge accessibility", () => {
  it("hides the decorative icon from assistive technology (WCAG 1.1.1)", () => {
    const { container } = render(<ExerciseCardPointsBadge score={1} maxScore={3} />)
    const svg = container.querySelector("svg")
    expect(svg).not.toBeNull()
    expect(svg?.closest('[aria-hidden="true"]')).not.toBeNull()
  })

  it("still shows the points label and score as text", () => {
    render(<ExerciseCardPointsBadge score={1} maxScore={3} />)
    expect(screen.getByText("points-label")).toBeInTheDocument()
    expect(screen.getByTestId("exercise-points")).toHaveTextContent("1/3")
  })
})
