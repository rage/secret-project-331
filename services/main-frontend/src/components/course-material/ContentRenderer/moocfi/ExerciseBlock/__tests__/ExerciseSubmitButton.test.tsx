"use client"

import "@testing-library/jest-dom"
import { fireEvent, render, screen } from "@testing-library/react"

import ExerciseSubmitButton from "../ExerciseSubmitButton"

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
    const status = screen.getByRole("status")
    expect(status).toHaveTextContent("Each option can be chosen only once.")
  })

  it("lists every blocking reason", () => {
    renderButton({
      blockers: ["Please answer all parts of the exercise.", "The deadline has passed."],
    })
    expect(screen.getAllByRole("listitem")).toHaveLength(2)
    const status = screen.getByRole("status")
    expect(status).toHaveTextContent("Please answer all parts of the exercise.")
    expect(status).toHaveTextContent("The deadline has passed.")
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
