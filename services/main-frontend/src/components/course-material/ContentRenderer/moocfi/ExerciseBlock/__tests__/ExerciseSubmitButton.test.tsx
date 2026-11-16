"use client"

import "@testing-library/jest-dom"
import { announce } from "@react-aria/live-announcer"
import { fireEvent, render, screen } from "@testing-library/react"

import ExerciseSubmitButton from "../ExerciseSubmitButton"

jest.mock("@react-aria/live-announcer", () => ({ announce: jest.fn() }))

// react-i18next is mocked in tests/setup-jest.js, so t() returns the translation key. Blockers are
// already-localized strings produced by the exercise/host, so we pass literal strings here.
const renderButton = (props: Partial<React.ComponentProps<typeof ExerciseSubmitButton>> = {}) => {
  const onSubmit = jest.fn()
  const utils = render(
    <ExerciseSubmitButton isPending={false} blockers={[]} onSubmit={onSubmit} {...props} />,
  )
  return { ...utils, onSubmit }
}

describe("ExerciseSubmitButton accessibility", () => {
  it("submits when there are no blockers", () => {
    const { onSubmit } = renderButton()
    fireEvent.click(screen.getByRole("button", { name: "submit-button" }))
    expect(onSubmit).toHaveBeenCalledTimes(1)
  })

  it("stays focusable but exposes aria-disabled when there are blockers (WCAG 4.1.2)", () => {
    renderButton({ blockers: ["Please check your answer."] })
    const button = screen.getByRole("button", { name: "submit-button" })
    expect(button).not.toBeDisabled()
    expect(button).toHaveAttribute("aria-disabled", "true")
  })

  it("proactively shows the reasons the button is disabled, without a click", () => {
    renderButton({ blockers: ["Each option can be chosen only once."] })
    expect(screen.getByText("Each option can be chosen only once.")).toBeVisible()
  })

  it("stays silent until a blocked Submit, then speaks the reasons", () => {
    jest.mocked(announce).mockClear()
    renderButton({ blockers: ["Please check your answer."] })
    expect(announce).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole("button", { name: "submit-button" }))
    expect(announce).toHaveBeenCalledWith("Please check your answer.", "polite")
  })

  it("lists every blocking reason", () => {
    renderButton({
      blockers: ["Please answer all parts of the exercise.", "The deadline has passed."],
    })
    expect(screen.getAllByRole("listitem")).toHaveLength(2)
    expect(screen.getByText("Please answer all parts of the exercise.")).toBeVisible()
    expect(screen.getByText("The deadline has passed.")).toBeVisible()
  })

  it("describes the button via aria-describedby so screen readers know why it is disabled", () => {
    renderButton({ blockers: ["Each option can be chosen only once."] })
    const button = screen.getByRole("button", { name: "submit-button" })
    expect(button).toHaveAccessibleDescription("Each option can be chosen only once.")
  })

  it("does not submit when blocked by a reason", () => {
    const { onSubmit } = renderButton({ blockers: ["Please check your answer."] })
    fireEvent.click(screen.getByRole("button", { name: "submit-button" }))
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it("does not submit while a submission is pending", () => {
    const { onSubmit } = renderButton({ isPending: true })
    const button = screen.getByRole("button", { name: "submit-button" })
    expect(button).toHaveAttribute("aria-disabled", "true")
    fireEvent.click(button)
    expect(onSubmit).not.toHaveBeenCalled()
  })
})
