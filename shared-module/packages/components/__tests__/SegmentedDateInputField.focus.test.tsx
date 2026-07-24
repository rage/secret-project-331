"use client"

import "@testing-library/jest-dom"
import { fireEvent, render, screen, within } from "@testing-library/react"
import { useForm } from "react-hook-form"

import { DateTimeLocalField } from "../src/components/DateTimeLocalField"
import { TimeField } from "../src/components/TimeField"
import "../tests/test-i18n"

// DateTimeLocalField/DateField render through PickerSegmentedField and TimeField through
// NonPickerSegmentedField; both get the same focus-within fix, so both are exercised here.

// Reads the react-hook-form touched flag into the DOM so tests can assert whether blur committed
// (the field's onBlur is what marks it touched / would trigger validate-on-blur).
function DateTimeHarness() {
  const { control, formState } = useForm<{ dt: string }>({
    defaultValues: { dt: "2026-03-11T12:30" },
  })
  return (
    <>
      <DateTimeLocalField name="dt" control={control} label="Publish at" />
      <span data-testid="touched">{formState.touchedFields.dt ? "touched" : "untouched"}</span>
      <button type="button">outside</button>
    </>
  )
}

function TimeHarness() {
  const { control, formState } = useForm<{ t: string }>({
    defaultValues: { t: "12:30" },
  })
  return (
    <>
      <TimeField name="t" control={control} label="Time" />
      <span data-testid="touched">{formState.touchedFields.t ? "touched" : "untouched"}</span>
      <button type="button">outside</button>
    </>
  )
}

const spinbuttonsIn = (groupName: string): HTMLElement[] =>
  within(screen.getByRole("group", { name: groupName })).getAllByRole("spinbutton")

const firstSpinbutton = (groupName: string): HTMLElement => {
  const [segment] = spinbuttonsIn(groupName)
  if (!segment) {
    throw new Error(`no spinbutton segment found in group "${groupName}"`)
  }
  return segment
}

describe("SegmentedDateInputField focus and blur handling (issue #1756)", () => {
  test("commits blur (marks the field touched) when focus leaves the group", () => {
    render(<DateTimeHarness />)
    const segment = firstSpinbutton("Publish at")
    const outside = screen.getByRole("button", { name: "outside" })

    fireEvent.focusIn(segment)
    expect(screen.getByTestId("touched")).toHaveTextContent("untouched")

    fireEvent.focusOut(segment, { relatedTarget: outside })
    expect(screen.getByTestId("touched")).toHaveTextContent("touched")
  })

  test("commits blur even when focus moves to a non-focusable target (relatedTarget === null)", () => {
    render(<DateTimeHarness />)
    const segment = firstSpinbutton("Publish at")

    fireEvent.focusIn(segment)
    fireEvent.focusOut(segment, { relatedTarget: null })

    expect(screen.getByTestId("touched")).toHaveTextContent("touched")
  })

  test("does not commit blur while moving focus between segments of the same field", () => {
    render(<DateTimeHarness />)
    const segments = spinbuttonsIn("Publish at")
    expect(segments.length).toBeGreaterThan(1)
    const [first, second] = segments as [HTMLElement, HTMLElement]

    fireEvent.focusIn(first)
    fireEvent.focusOut(first, { relatedTarget: second })
    fireEvent.focusIn(second)

    expect(screen.getByTestId("touched")).toHaveTextContent("untouched")
  })

  test("does not commit blur while the calendar popover is open", () => {
    render(<DateTimeHarness />)
    const group = screen.getByRole("group", { name: "Publish at" })
    const segment = firstSpinbutton("Publish at")

    fireEvent.focusIn(segment)
    fireEvent.click(within(group).getByRole("button"))
    const dialog = screen.getByRole("dialog")

    // The popover is portaled outside the group, so focus entering it reads as "leaving"; it must
    // NOT mark the field touched / fire validate-on-blur mid-interaction.
    fireEvent.focusOut(segment, { relatedTarget: dialog })

    expect(screen.getByTestId("touched")).toHaveTextContent("untouched")
  })

  test("time-only field commits blur when focus leaves", () => {
    render(<TimeHarness />)
    const segment = firstSpinbutton("Time")
    const outside = screen.getByRole("button", { name: "outside" })

    fireEvent.focusIn(segment)
    fireEvent.focusOut(segment, { relatedTarget: outside })

    expect(screen.getByTestId("touched")).toHaveTextContent("touched")
  })
})
