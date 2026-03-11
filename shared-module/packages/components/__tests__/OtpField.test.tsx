"use client"

/* eslint-disable i18next/no-literal-string */

import { fireEvent, screen } from "@testing-library/react"

import { OtpField } from "../src/components/OtpField"

import { pasteText, renderUi } from "./testUtils"

describe("OtpField", () => {
  test("types across slots and advances focus", () => {
    renderUi(<OtpField label="Verification code" length={4} />)

    const slot1 = screen.getByLabelText("Code character 1")
    const slot2 = screen.getByLabelText("Code character 2")

    fireEvent.change(slot1, { target: { value: "1" } })

    expect(slot1).toHaveValue("1")
    expect(document.activeElement).toBe(slot2)
  })

  test("supports backspace and arrow navigation", () => {
    renderUi(<OtpField label="Verification code" length={4} defaultValue="12" />)

    const slot2 = screen.getByLabelText("Code character 2")
    const slot3 = screen.getByLabelText("Code character 3")

    slot3.focus()
    fireEvent.keyDown(slot3, { key: "Backspace" })
    expect(slot2).toHaveValue("")

    fireEvent.keyDown(slot2, { key: "ArrowRight" })
    expect(document.activeElement).toBe(slot3)
  })

  test("distributes pasted text across the remaining slots", () => {
    renderUi(<OtpField label="Verification code" length={4} />)

    const slot1 = screen.getByLabelText("Code character 1")
    const slot2 = screen.getByLabelText("Code character 2")
    const slot3 = screen.getByLabelText("Code character 3")
    const slot4 = screen.getByLabelText("Code character 4")

    pasteText(slot1, "4821")

    expect(slot1).toHaveValue("4")
    expect(slot2).toHaveValue("8")
    expect(slot3).toHaveValue("2")
    expect(slot4).toHaveValue("1")
  })

  test("supports controlled value updates", () => {
    const { rerender } = renderUi(
      <OtpField label="Verification code" value="12" onChange={() => null} />,
    )
    expect(screen.getByLabelText("Code character 1")).toHaveValue("1")
    expect(screen.getByLabelText("Code character 2")).toHaveValue("2")

    rerender(<OtpField label="Verification code" value="9876" onChange={() => null} />)
    expect(screen.getByLabelText("Code character 1")).toHaveValue("9")
    expect(screen.getByLabelText("Code character 4")).toHaveValue("6")
  })

  test("calls onComplete and submits the hidden form value", () => {
    const onComplete = jest.fn()
    const { container } = renderUi(
      <form>
        <OtpField label="Verification code" name="otp" length={4} onComplete={onComplete} />
      </form>,
    )

    fireEvent.change(screen.getByLabelText("Code character 1"), { target: { value: "1" } })
    fireEvent.change(screen.getByLabelText("Code character 2"), { target: { value: "2" } })
    fireEvent.change(screen.getByLabelText("Code character 3"), { target: { value: "3" } })
    fireEvent.change(screen.getByLabelText("Code character 4"), { target: { value: "4" } })

    expect(onComplete).toHaveBeenCalledWith("1234")

    const form = container.querySelector("form")
    expect(form).not.toBeNull()
    const formData = new FormData(form as HTMLFormElement)
    expect(formData.get("otp")).toBe("1234")
  })
})
