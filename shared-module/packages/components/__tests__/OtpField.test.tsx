"use client"

import { fireEvent, render, screen } from "@testing-library/react"

import { OtpField } from "../src/components/OtpField"
import { FormHarness, pasteText, renderWithForm } from "./testUtils"

describe("OtpField", () => {
  test("types across slots and advances focus", () => {
    renderWithForm<{ otp: string }>(
      (control) => <OtpField name="otp" control={control} label="Verification code" length={4} />,
      { defaultValues: { otp: "" } },
    )

    const slot1 = screen.getByLabelText("Code character 1")
    const slot2 = screen.getByLabelText("Code character 2")

    fireEvent.change(slot1, { target: { value: "1" } })

    expect(slot1).toHaveValue("1")
    expect(document.activeElement).toBe(slot2)
  })

  test("supports backspace and arrow navigation", () => {
    renderWithForm<{ otp: string }>(
      (control) => <OtpField name="otp" control={control} label="Verification code" length={4} />,
      { defaultValues: { otp: "12" } },
    )

    const slot2 = screen.getByLabelText("Code character 2")
    const slot3 = screen.getByLabelText("Code character 3")

    slot3.focus()
    fireEvent.keyDown(slot3, { key: "Backspace" })
    expect(slot2).toHaveValue("")

    fireEvent.keyDown(slot2, { key: "ArrowRight" })
    expect(document.activeElement).toBe(slot3)
  })

  test("distributes pasted text across the remaining slots", () => {
    const { getValues } = renderWithForm<{ otp: string }>(
      (control) => <OtpField name="otp" control={control} label="Verification code" length={4} />,
      { defaultValues: { otp: "" } },
    )

    const slot1 = screen.getByLabelText("Code character 1")
    const slot2 = screen.getByLabelText("Code character 2")
    const slot3 = screen.getByLabelText("Code character 3")
    const slot4 = screen.getByLabelText("Code character 4")

    pasteText(slot1, "4821")

    expect(slot1).toHaveValue("4")
    expect(slot2).toHaveValue("8")
    expect(slot3).toHaveValue("2")
    expect(slot4).toHaveValue("1")
    expect(getValues().otp).toBe("4821")
  })

  test("supports form-driven value updates", () => {
    const { rerender } = render(
      <FormHarness<{ otp: string }> key="a" defaultValues={{ otp: "12" }}>
        {(control) => (
          <OtpField name="otp" control={control} label="Verification code" length={4} />
        )}
      </FormHarness>,
    )
    expect(screen.getByLabelText("Code character 1")).toHaveValue("1")
    expect(screen.getByLabelText("Code character 2")).toHaveValue("2")

    rerender(
      <FormHarness<{ otp: string }> key="b" defaultValues={{ otp: "9876" }}>
        {(control) => (
          <OtpField name="otp" control={control} label="Verification code" length={4} />
        )}
      </FormHarness>,
    )
    expect(screen.getByLabelText("Code character 1")).toHaveValue("9")
    expect(screen.getByLabelText("Code character 4")).toHaveValue("6")
  })

  test("focuses the first slot when the label is clicked", () => {
    renderWithForm<{ otp: string }>((control) => (
      <OtpField name="otp" control={control} label="Verification code" length={4} />
    ))

    fireEvent.click(screen.getByText("Verification code"))

    expect(document.activeElement).toBe(screen.getByLabelText("Code character 1"))
  })

  test("calls onComplete and submits the hidden form value", () => {
    const onComplete = jest.fn()
    const { container, getValues } = renderWithForm<{ otp: string }>(
      (control) => (
        <form>
          <OtpField
            name="otp"
            control={control}
            label="Verification code"
            length={4}
            onComplete={onComplete}
          />
        </form>
      ),
      { defaultValues: { otp: "" } },
    )

    fireEvent.change(screen.getByLabelText("Code character 1"), { target: { value: "1" } })
    fireEvent.change(screen.getByLabelText("Code character 2"), { target: { value: "2" } })
    fireEvent.change(screen.getByLabelText("Code character 3"), { target: { value: "3" } })
    fireEvent.change(screen.getByLabelText("Code character 4"), { target: { value: "4" } })

    expect(onComplete).toHaveBeenCalledWith("1234")
    expect(getValues().otp).toBe("1234")

    const form = container.querySelector("form")
    expect(form).not.toBeNull()
    const formData = new FormData(form as HTMLFormElement)
    expect(formData.get("otp")).toBe("1234")
  })

  test("surfaces required and invalid state on the visible otp controls", () => {
    renderWithForm<{ otp: string }>((control) => (
      <OtpField
        name="otp"
        control={control}
        errorMessage="Required"
        label="Verification code"
        isRequired
      />
    ))

    expect(screen.getByRole("group", { name: /Verification code/ })).toBeInTheDocument()
    expect(screen.getByLabelText("Code character 1")).toHaveAttribute("aria-required", "true")
    expect(screen.getByLabelText("Code character 1")).toHaveAttribute("aria-invalid", "true")
    expect(screen.getByRole("alert")).toHaveTextContent("Required")
  })
})
