"use client"

import { resetLocalTimeZone, setLocalTimeZone } from "@internationalized/date"
import { fireEvent, render, screen, within } from "@testing-library/react"

import { DateField } from "../src/components/DateField"
import { DateTimeLocalField } from "../src/components/DateTimeLocalField"
import { FileField } from "../src/components/FileField"
import { TimeField } from "../src/components/TimeField"
import { changeFiles, FormHarness, renderWithForm } from "./testUtils"

describe("date and time fields", () => {
  test("DateField renders segmented controls and keeps a synchronized hidden value", () => {
    const { container } = renderWithForm<{ d: string }>(
      (control) => <DateField name="d" control={control} label="Date" />,
      { defaultValues: { d: "2026-03-11" } },
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
  })

  test("DateField updates the hidden value when the value prop changes", () => {
    const { container, rerender } = render(
      <FormHarness<{ d: string }> key="a" defaultValues={{ d: "2026-03-11" }}>
        {(control) => <DateField key="a" name="d" control={control} label="Date" />}
      </FormHarness>,
    )
    expect(container.querySelector('input[type="hidden"]')).toHaveValue("2026-03-11")

    rerender(
      <FormHarness<{ d: string }> key="b" defaultValues={{ d: "2026-03-12" }}>
        {(control) => <DateField key="b" name="d" control={control} label="Date" />}
      </FormHarness>,
    )
    expect(container.querySelector('input[type="hidden"]')).toHaveValue("2026-03-12")
  })

  test("TimeField renders segmented controls and keeps a synchronized hidden value", () => {
    const { container } = renderWithForm<{ t: string }>(
      (control) => <TimeField name="t" control={control} label="Time" />,
      { defaultValues: { t: "12:30" } },
    )
    expect(screen.getByRole("group", { name: "Time" })).toBeInTheDocument()
    expect(
      within(screen.getByRole("group", { name: "Time" })).getAllByRole("spinbutton"),
    ).not.toHaveLength(0)
    expect(container.querySelector('input[type="time"]')).not.toBeInTheDocument()
    expect(container.querySelector('input[type="hidden"]')).toHaveValue("12:30")
    expect(screen.queryByRole("button")).not.toBeInTheDocument()
  })

  test("TimeField updates the hidden value when the value prop changes", () => {
    const { container, rerender } = render(
      <FormHarness<{ t: string }> key="a" defaultValues={{ t: "12:30" }}>
        {(control) => <TimeField name="t" control={control} label="Time" />}
      </FormHarness>,
    )
    expect(container.querySelector('input[type="hidden"]')).toHaveValue("12:30")

    rerender(
      <FormHarness<{ t: string }> key="b" defaultValues={{ t: "11:00" }}>
        {(control) => <TimeField name="t" control={control} label="Time" />}
      </FormHarness>,
    )
    expect(container.querySelector('input[type="hidden"]')).toHaveValue("11:00")
  })

  test("opens a calendar dialog for date fields", () => {
    renderWithForm<{ d: string }>(
      (control) => <DateField name="d" control={control} label="Date" />,
      { defaultValues: { d: "2026-03-11" } },
    )

    fireEvent.click(within(screen.getByRole("group", { name: "Date" })).getByRole("button"))

    expect(screen.getByRole("dialog")).toBeInTheDocument()
    expect(screen.getByRole("grid")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /Choose month and year: March/ })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /Choose month and year: 2026/ })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Clear" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Today" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Tomorrow" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Next week" })).toBeInTheDocument()
  })

  test("lets users change the visible month from the inline month and year pickers", () => {
    renderWithForm<{ d: string }>(
      (control) => <DateField name="d" control={control} label="Date" />,
      { defaultValues: { d: "2026-03-11" } },
    )

    fireEvent.click(within(screen.getByRole("group", { name: "Date" })).getByRole("button"))
    fireEvent.click(screen.getByRole("button", { name: /Choose month and year: 2026/ }))

    expect(screen.queryByRole("grid")).not.toBeInTheDocument()
    expect(screen.getByRole("group", { name: "Year" })).toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: "2027" }))
    expect(screen.getByRole("grid")).toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: /Choose month and year: March/ }))
    expect(screen.queryByRole("grid")).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: "April" }))
    expect(screen.getByRole("grid")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /Choose month and year: April/ })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /Choose month and year: 2027/ })).toBeInTheDocument()
  })

  test("supports description and invalid wiring", () => {
    const { container } = renderWithForm<{ dt: string }>((control) => (
      <DateTimeLocalField
        name="dt"
        control={control}
        label="Publish at"
        description="Local time"
        errorMessage="Invalid"
      />
    ))
    const field = screen.getByRole("group", { name: "Publish at" })
    expect(field).toHaveAttribute("aria-describedby")
    expect(field).toHaveAttribute("aria-invalid", "true")
    expect(within(field).getByRole("button")).toHaveAttribute("aria-haspopup", "dialog")
    expect(container.querySelector('input[type="datetime-local"]')).not.toBeInTheDocument()
  })

  test("shows the combined time selector in the datetime popover", () => {
    renderWithForm<{ dt: string }>(
      (control) => <DateTimeLocalField name="dt" control={control} label="Publish at" />,
      { defaultValues: { dt: "2026-03-11T12:30" } },
    )

    fireEvent.click(within(screen.getByRole("group", { name: "Publish at" })).getByRole("button"))

    expect(screen.getByRole("dialog")).toBeInTheDocument()
    const timeGroup = screen.getByRole("group", { name: "Time" })
    expect(timeGroup).toBeInTheDocument()
    expect(within(timeGroup).getByRole("textbox")).toBeInTheDocument()
    expect(within(timeGroup).getByRole("button", { name: "Decrease hour" })).toBeInTheDocument()
    expect(within(timeGroup).getByRole("button", { name: "Decrease minute" })).toBeInTheDocument()
    expect(within(timeGroup).getByRole("group", { name: "Day period" })).toBeInTheDocument()
  })

  test("replaces the calendar and time panels while the inline month picker is open", () => {
    renderWithForm<{ dt: string }>(
      (control) => <DateTimeLocalField name="dt" control={control} label="Publish at" />,
      { defaultValues: { dt: "2026-03-11T12:30" } },
    )

    fireEvent.click(within(screen.getByRole("group", { name: "Publish at" })).getByRole("button"))
    fireEvent.click(screen.getByRole("button", { name: /Choose month and year: March/ }))

    expect(screen.queryByRole("grid")).not.toBeInTheDocument()
    expect(screen.queryByRole("group", { name: "Time" })).not.toBeInTheDocument()
    expect(screen.getByText("Choose month")).toBeInTheDocument()
  })

  test("supports 24 hour mode without a day-period column", () => {
    renderWithForm<{ dt: string }>(
      (control) => (
        <DateTimeLocalField name="dt" control={control} label="Publish at" hourCycle={24} />
      ),
      { defaultValues: { dt: "2026-03-11T12:30" } },
    )

    fireEvent.click(within(screen.getByRole("group", { name: "Publish at" })).getByRole("button"))

    const timeGroup = screen.getByRole("group", { name: "Time" })
    expect(within(timeGroup).getByRole("textbox")).toBeInTheDocument()
    expect(within(timeGroup).getByRole("button", { name: "Decrease hour" })).toBeInTheDocument()
    expect(within(timeGroup).getByRole("button", { name: "Decrease minute" })).toBeInTheDocument()
    expect(within(timeGroup).queryByRole("group", { name: "Day period" })).not.toBeInTheDocument()
  })

  test("keeps the datetime popover open after choosing a date", () => {
    const { container } = renderWithForm<{ dt: string }>(
      (control) => <DateTimeLocalField name="dt" control={control} label="Publish at" />,
      { defaultValues: { dt: "2026-03-11T12:30" } },
    )

    fireEvent.click(within(screen.getByRole("group", { name: "Publish at" })).getByRole("button"))
    fireEvent.click(within(screen.getByRole("grid")).getByText("12"))

    expect(screen.getByRole("dialog")).toBeInTheDocument()
    expect(screen.getByRole("group", { name: "Time" })).toBeInTheDocument()
    expect(container.querySelector('input[type="hidden"]')).toHaveValue("2026-03-12T12:30")
  })

  test("clears the selection from the quick actions", () => {
    const { container } = renderWithForm<{ dt: string }>(
      (control) => <DateTimeLocalField name="dt" control={control} label="Publish at" />,
      { defaultValues: { dt: "2026-03-11T12:30" } },
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
      const { container } = renderWithForm<{ d: string }>(
        (control) => <DateField name="d" control={control} label="Date" />,
        { defaultValues: { d: "" } },
      )

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
    renderWithForm<{ d: string; t: string }>((control) => (
      <>
        <DateField name="d" control={control} label="Disabled date" isDisabled />
        <TimeField name="t" control={control} label="Readonly time" isReadOnly />
      </>
    ))

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
  test("forwards file selection and updates form value", () => {
    const { container, getValues } = renderWithForm<{ files: File[] }>(
      (control) => <FileField name="files" control={control} label="Documents" multiple />,
      { defaultValues: { files: [] } },
    )
    const input = container.querySelector('input[type="file"]') as HTMLInputElement

    changeFiles(input, [new File(["a"], "alpha.txt"), new File(["b"], "beta.txt")])

    expect(screen.getByText("alpha.txt, beta.txt")).toBeInTheDocument()
    expect(getValues().files.map((file) => file.name)).toEqual(["alpha.txt", "beta.txt"])
  })

  test("supports disabled behavior", () => {
    const { container } = renderWithForm<{ files: File[] }>((control) => (
      <FileField name="files" control={control} label="Avatar" isDisabled />
    ))
    const input = container.querySelector('input[type="file"]') as HTMLInputElement

    expect(screen.getByRole("button", { name: /Avatar/i })).toBeDisabled()
    expect(input).toBeDisabled()
  })

  test("surfaces required and invalid state on the visible button", () => {
    renderWithForm<{ files: File[] }>((control) => (
      <FileField name="files" control={control} label="Documents" isRequired />
    ))

    expect(screen.getByRole("button", { name: /Documents/i })).toHaveAccessibleDescription(
      /required/i,
    )
  })
})
