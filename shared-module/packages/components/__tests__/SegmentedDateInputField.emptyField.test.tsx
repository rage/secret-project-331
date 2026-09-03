"use client"

import "@testing-library/jest-dom"
import { fireEvent, render, screen, within } from "@testing-library/react"
import { useForm } from "react-hook-form"

import { DateTimeLocalField } from "../src/components/DateTimeLocalField"
import { TimeField } from "../src/components/TimeField"
import "../tests/test-i18n"

// An empty floating field collapses its segment row away, and for a TimeField (no calendar
// trigger) the label is then the only route in — react-aria puts `focusManager.focusFirst()` there.
// So the collapse has to leave the segments focusable, which rules out `visibility: hidden` and
// `display: none`.

function EmptyTimeHarness() {
  const { control } = useForm<{ t: string }>({ defaultValues: { t: "" } })
  return <TimeField name="t" control={control} label="Time" data-testid="time" />
}

function EmptyDateTimeHarness() {
  const { control } = useForm<{ dt: string }>({ defaultValues: { dt: "" } })
  return <DateTimeLocalField name="dt" control={control} label="Publish at" />
}

/** react-aria's segments listen for native `beforeinput`, which the synthetic fireEvent helpers don't reach. */
function typeIntoFocusedSegment(character: string) {
  const focused = document.activeElement
  if (!focused || focused === document.body) {
    throw new Error(`nothing focused to type "${character}" into`)
  }
  fireEvent(
    focused,
    new InputEvent("beforeinput", {
      data: character,
      inputType: "insertText",
      bubbles: true,
      cancelable: true,
    }),
  )
}

// `hidden: true` keeps the query neutral about the collapse, so a regression surfaces as a focus
// failure rather than as a segment that cannot be found.
const segmentsIn = (groupName: string): HTMLElement[] =>
  within(screen.getByRole("group", { name: groupName })).getAllByRole("spinbutton", {
    hidden: true,
  })

const firstSegmentIn = (groupName: string): HTMLElement => {
  const [segment] = segmentsIn(groupName)
  if (!segment) {
    throw new Error(`no spinbutton segment found in group "${groupName}"`)
  }
  return segment
}

describe("empty floating segmented field stays reachable", () => {
  test("clicking the label focuses the first segment of an empty time field", () => {
    render(<EmptyTimeHarness />)

    fireEvent.click(screen.getByText("Time"))

    expect(firstSegmentIn("Time")).toHaveFocus()
  })

  test("typing after the label click commits a value to the hidden input", () => {
    render(<EmptyTimeHarness />)
    fireEvent.click(screen.getByText("Time"))

    // Typed at whatever the label click focused, and at whatever each completed segment advances
    // to, so the whole keyboard-only route is under test rather than the segments in isolation.
    typeIntoFocusedSegment("9")
    typeIntoFocusedSegment("4")
    typeIntoFocusedSegment("5")
    typeIntoFocusedSegment("P")

    expect(screen.getByTestId("time-value")).toHaveValue("21:45")
  })

  test("clicking the label focuses the first segment of an empty picker field", () => {
    render(<EmptyDateTimeHarness />)

    fireEvent.click(screen.getByText("Publish at"))

    expect(firstSegmentIn("Publish at")).toHaveFocus()
  })

  test("the collapsed row hides its glyphs without going out of focus reach", () => {
    render(<EmptyTimeHarness />)
    const row = firstSegmentIn("Time").parentElement
    if (!row) {
      throw new Error("the segments row is missing")
    }

    const { height, opacity, visibility } = getComputedStyle(row)
    expect(height).toBe("0px")
    expect(opacity).toBe("0")
    expect(visibility).not.toBe("hidden")
  })
})
