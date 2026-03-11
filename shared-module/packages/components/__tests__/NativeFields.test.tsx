"use client"

/* eslint-disable i18next/no-literal-string */

import { screen } from "@testing-library/react"

import { DateField } from "../src/components/DateField"
import { DateTimeLocalField } from "../src/components/DateTimeLocalField"
import { FileField } from "../src/components/FileField"
import { TimeField } from "../src/components/TimeField"

import { changeFiles, renderUi } from "./testUtils"

describe("native date and time fields", () => {
  test("supports native prop passthrough and controlled updates", () => {
    const { rerender } = renderUi(
      <DateField label="Date" value="2026-03-11" onChange={() => null} />,
    )
    expect(screen.getByLabelText("Date")).toHaveValue("2026-03-11")

    rerender(<TimeField label="Time" value="12:30" onChange={() => null} />)
    expect(screen.getByLabelText("Time")).toHaveValue("12:30")
  })

  test("supports description and invalid wiring", () => {
    renderUi(
      <DateTimeLocalField label="Publish at" description="Local time" errorMessage="Invalid" />,
    )
    const input = screen.getByLabelText("Publish at")
    expect(input).toHaveAttribute("aria-describedby")
    expect(input).toHaveAttribute("aria-invalid", "true")
  })

  test("supports disabled and readonly behavior", () => {
    renderUi(
      <>
        <DateField label="Disabled date" disabled />
        <TimeField label="Readonly time" readOnly defaultValue="10:00" />
      </>,
    )

    expect(screen.getByLabelText("Disabled date")).toBeDisabled()
    expect(screen.getByLabelText("Readonly time")).toHaveAttribute("readonly")
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
