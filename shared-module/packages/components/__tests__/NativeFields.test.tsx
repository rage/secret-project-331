"use client"

import { resetLocalTimeZone, setLocalTimeZone } from "@internationalized/date"
import { fireEvent, screen, within } from "@testing-library/react"

import { DateField } from "../src/components/DateField"
import { DateTimeLocalField } from "../src/components/DateTimeLocalField"
import { FileField } from "../src/components/FileField"
import { TimeField } from "../src/components/TimeField"

import { changeFiles, renderUi } from "./testUtils"

describe("date and time fields", () => {
  test("renders React Aria segmented fields while keeping string values for forms", () => {
    const { container, rerender } = renderUi(
      <DateField label="Date" value="2026-03-11" onChange={() => null} />,
    )
    expect(screen.getByRole("group", { name: "Date" })).toBeInTheDocument()
    expect(
      within(screen.getByRole("group", { name: "Date" })).getAllByRole("spinbutton"),
    ).not.toHaveLength(0)
    expect(container.querySelector('input[type="date"]')).not.toBeInTheDocument()
    expect(container.querySelector('input[type="hidden"]')).toHaveValue("2026-03-11")
    expect(within(screen.getByRole("group", { name: "Date" })).getByRole("button")).toHaveAttribute(
      "aria-haspopup",
      "dialog",
    )

    rerender(<TimeField label="Time" value="12:30" onChange={() => null} />)
    expect(screen.getByRole("group", { name: "Time" })).toBeInTheDocument()
    expect(
      within(screen.getByRole("group", { name: "Time" })).getAllByRole("spinbutton"),
    ).not.toHaveLength(0)
    expect(container.querySelector('input[type="time"]')).not.toBeInTheDocument()
    expect(container.querySelector('input[type="hidden"]')).toHaveValue("12:30")
    expect(screen.queryByRole("button")).not.toBeInTheDocument()
  })

  test("opens a calendar dialog for date fields", () => {
    renderUi(<DateField label="Date" defaultValue="2026-03-11" />)

    fireEvent.click(within(screen.getByRole("group", { name: "Date" })).getByRole("button"))

    expect(screen.getByRole("dialog")).toBeInTheDocument()
    expect(screen.getByRole("grid")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /Choose month and year:/ })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Clear" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Today" })).toBeInTheDocument()
  })

  test("lets users change the visible month from the dedicated year and month chooser", () => {
    renderUi(<DateField label="Date" defaultValue="2026-03-11" />)

    fireEvent.click(within(screen.getByRole("group", { name: "Date" })).getByRole("button"))
    fireEvent.click(screen.getByRole("button", { name: /Choose month and year:/ }))

    expect(screen.queryByRole("grid")).not.toBeInTheDocument()
    expect(screen.getByRole("group", { name: "Year" })).toBeInTheDocument()
    expect(screen.getByRole("group", { name: "Month" })).toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: "2027" }))
    fireEvent.click(screen.getByRole("button", { name: "April" }))

    expect(screen.getByRole("grid")).toBeInTheDocument()
    expect(screen.getByText("April 2027")).toBeInTheDocument()
  })

  test("supports description and invalid wiring", () => {
    const { container } = renderUi(
      <DateTimeLocalField label="Publish at" description="Local time" errorMessage="Invalid" />,
    )
    const field = screen.getByRole("group", { name: "Publish at" })
    expect(field).toHaveAttribute("aria-describedby")
    expect(field).toHaveAttribute("aria-invalid", "true")
    expect(within(field).getByRole("button")).toHaveAttribute("aria-haspopup", "dialog")
    expect(container.querySelector('input[type="datetime-local"]')).not.toBeInTheDocument()
  })

  test("shows the combined time selector in the datetime popover", () => {
    renderUi(<DateTimeLocalField label="Publish at" defaultValue="2026-03-11T12:30" />)

    fireEvent.click(within(screen.getByRole("group", { name: "Publish at" })).getByRole("button"))

    expect(screen.getByRole("dialog")).toBeInTheDocument()
    const timeGroup = screen.getByRole("group", { name: "Time" })
    expect(timeGroup).toBeInTheDocument()
    expect(within(timeGroup).getByRole("radiogroup", { name: "Hour" })).toBeInTheDocument()
    expect(within(timeGroup).getByRole("radiogroup", { name: "Minutes" })).toBeInTheDocument()
    expect(within(timeGroup).getByRole("radiogroup", { name: "AM / PM" })).toBeInTheDocument()
  })

  test("replaces the calendar and time panels while the month and year chooser is open", () => {
    renderUi(<DateTimeLocalField label="Publish at" defaultValue="2026-03-11T12:30" />)

    fireEvent.click(within(screen.getByRole("group", { name: "Publish at" })).getByRole("button"))
    fireEvent.click(screen.getByRole("button", { name: /Choose month and year:/ }))

    expect(screen.queryByRole("grid")).not.toBeInTheDocument()
    expect(screen.queryByRole("group", { name: "Time" })).not.toBeInTheDocument()
    expect(screen.getByRole("group", { name: "Year" })).toBeInTheDocument()
    expect(screen.getByRole("group", { name: "Month" })).toBeInTheDocument()
  })

  test("supports 24 hour mode without a day-period column", () => {
    renderUi(
      <DateTimeLocalField label="Publish at" defaultValue="2026-03-11T12:30" hourCycle={24} />,
    )

    fireEvent.click(within(screen.getByRole("group", { name: "Publish at" })).getByRole("button"))

    const timeGroup = screen.getByRole("group", { name: "Time" })
    expect(within(timeGroup).getByRole("radiogroup", { name: "Hour" })).toBeInTheDocument()
    expect(within(timeGroup).getByRole("radiogroup", { name: "Minutes" })).toBeInTheDocument()
    expect(within(timeGroup).queryByRole("radiogroup", { name: "AM / PM" })).not.toBeInTheDocument()
  })

  test("keeps the datetime popover open after choosing a date", () => {
    const { container } = renderUi(
      <DateTimeLocalField label="Publish at" defaultValue="2026-03-11T12:30" />,
    )

    fireEvent.click(within(screen.getByRole("group", { name: "Publish at" })).getByRole("button"))
    fireEvent.click(within(screen.getByRole("grid")).getByText("12"))

    expect(screen.getByRole("dialog")).toBeInTheDocument()
    expect(screen.getByRole("group", { name: "Time" })).toBeInTheDocument()
    expect(container.querySelector('input[type="hidden"]')).toHaveValue("2026-03-12T12:30")
  })

  test("clears the selection from the quick actions", () => {
    const { container } = renderUi(
      <DateTimeLocalField label="Publish at" defaultValue="2026-03-11T12:30" />,
    )

    fireEvent.click(within(screen.getByRole("group", { name: "Publish at" })).getByRole("button"))
    fireEvent.click(screen.getByRole("button", { name: "Clear" }))

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    expect(container.querySelector('input[type="hidden"]')).toHaveValue("")
  })

  test("jumps to today from the quick actions", () => {
    jest.useFakeTimers()
    jest.setSystemTime(new Date("2026-03-13T12:00:00Z"))
    setLocalTimeZone("UTC")

    try {
      const { container } = renderUi(<DateField label="Date" />)

      fireEvent.click(within(screen.getByRole("group", { name: "Date" })).getByRole("button"))
      fireEvent.click(screen.getByRole("button", { name: "Today" }))

      expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
      expect(container.querySelector('input[type="hidden"]')).toHaveValue("2026-03-13")
    } finally {
      resetLocalTimeZone()
      jest.useRealTimers()
    }
  })

  test("supports disabled and readonly behavior", () => {
    renderUi(
      <>
        <DateField label="Disabled date" disabled />
        <TimeField label="Readonly time" readOnly defaultValue="10:00" />
      </>,
    )

    expect(screen.getByRole("group", { name: "Disabled date" })).toHaveAttribute(
      "aria-disabled",
      "true",
    )
    expect(screen.getByRole("group", { name: "Readonly time" })).toHaveAttribute(
      "aria-readonly",
      "true",
    )
  })
})

describe("FileField", () => {
  test("forwards file selection events and summaries", () => {
    const onChange = jest.fn()

    renderUi(<FileField label="Documents" multiple onChange={onChange} />)
    const input = screen.getByLabelText("Documents") as HTMLInputElement

    changeFiles(input, [new File(["a"], "alpha.txt"), new File(["b"], "beta.txt")])

    expect(onChange).toHaveBeenCalledTimes(1)
    expect(screen.getByText("alpha.txt, beta.txt")).toBeInTheDocument()
  })

  test("supports disabled behavior and ref forwarding", () => {
    const ref = { current: null as HTMLInputElement | null }
    renderUi(<FileField ref={ref} label="Avatar" disabled />)

    expect(screen.getByLabelText("Avatar")).toBeDisabled()
    expect(ref.current).toBeInstanceOf(HTMLInputElement)
  })
})
