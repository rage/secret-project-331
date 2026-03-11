"use client"

/* eslint-disable i18next/no-literal-string */

import { screen, within } from "@testing-library/react"

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

    rerender(<TimeField label="Time" value="12:30" onChange={() => null} />)
    expect(screen.getByRole("group", { name: "Time" })).toBeInTheDocument()
    expect(
      within(screen.getByRole("group", { name: "Time" })).getAllByRole("spinbutton"),
    ).not.toHaveLength(0)
    expect(container.querySelector('input[type="time"]')).not.toBeInTheDocument()
    expect(container.querySelector('input[type="hidden"]')).toHaveValue("12:30")
  })

  test("supports description and invalid wiring", () => {
    const { container } = renderUi(
      <DateTimeLocalField label="Publish at" description="Local time" errorMessage="Invalid" />,
    )
    const field = screen.getByRole("group", { name: "Publish at" })
    expect(field).toHaveAttribute("aria-describedby")
    expect(field).toHaveAttribute("aria-invalid", "true")
    expect(container.querySelector('input[type="datetime-local"]')).not.toBeInTheDocument()
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
