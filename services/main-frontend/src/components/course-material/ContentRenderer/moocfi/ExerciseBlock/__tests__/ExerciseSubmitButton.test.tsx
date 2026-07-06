"use client"

import "@testing-library/jest-dom"
import { fireEvent, render, screen } from "@testing-library/react"

import ExerciseSubmitButton from "../ExerciseSubmitButton"

// react-i18next is mocked in tests/setup-jest.js, so t() returns the translation key.
const renderButton = (props: Partial<React.ComponentProps<typeof ExerciseSubmitButton>> = {}) => {
  const onSubmit = jest.fn()
  const utils = render(
    <ExerciseSubmitButton
      isPending={false}
      answersIncomplete={false}
      onSubmit={onSubmit}
      {...props}
    />,
  )
  return { ...utils, onSubmit }
}

describe("ExerciseSubmitButton accessibility", () => {
  it("submits when the answer is complete", () => {
    const { onSubmit } = renderButton()
    fireEvent.click(screen.getByRole("button", { name: "submit-button" }))
    expect(onSubmit).toHaveBeenCalledTimes(1)
  })

  it("stays focusable but exposes aria-disabled when the answer is incomplete (WCAG 4.1.2)", () => {
    renderButton({ answersIncomplete: true })
    const button = screen.getByRole("button", { name: "submit-button" })
    expect(button).not.toBeDisabled()
    expect(button).toHaveAttribute("aria-disabled", "true")
  })

  it("explains why the button cannot be used yet via aria-describedby", () => {
    renderButton({ answersIncomplete: true })
    const button = screen.getByRole("button", { name: "submit-button" })
    expect(button).toHaveAccessibleDescription("answer-the-exercise-before-submitting")
  })

  it("shows a visible error in an alert when an incomplete answer is submitted", () => {
    const { onSubmit } = renderButton({ answersIncomplete: true })
    const alert = screen.getByRole("alert")
    expect(alert).toBeEmptyDOMElement()
    fireEvent.click(screen.getByRole("button", { name: "submit-button" }))
    expect(onSubmit).not.toHaveBeenCalled()
    expect(alert).toHaveTextContent("answer-the-exercise-before-submitting")
  })

  it("does not submit while a submission is pending", () => {
    const { onSubmit } = renderButton({ isPending: true })
    const button = screen.getByRole("button", { name: "submit-button" })
    expect(button).toHaveAttribute("aria-disabled", "true")
    fireEvent.click(button)
    expect(onSubmit).not.toHaveBeenCalled()
  })
})
