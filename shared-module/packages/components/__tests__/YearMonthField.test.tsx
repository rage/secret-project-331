"use client"

import { fireEvent, screen } from "@testing-library/react"

import { YearMonthField } from "../src/components/YearMonthField"

import { renderWithForm } from "./testUtils"

describe("YearMonthField", () => {
  test("opens month picker on click and updates RHF value", () => {
    const { getValues } = renderWithForm<{ ym: string }>(
      (control) => <YearMonthField name="ym" control={control} label="Start month" />,
      { defaultValues: { ym: "2026-05" } },
    )

    const trigger = screen.getByRole("button", { name: /May 2026/ })
    fireEvent.click(trigger)
    fireEvent.click(screen.getByRole("button", { name: "June" }))

    expect(getValues().ym).toBe("2026-06")
  })

  test("supports navigating to year view and selecting another year", () => {
    const { getValues } = renderWithForm<{ ym: string }>(
      (control) => <YearMonthField name="ym" control={control} label="Start month" />,
      { defaultValues: { ym: "2026-05" } },
    )

    const trigger = screen.getByRole("button", { name: /May 2026/ })
    fireEvent.click(trigger)
    fireEvent.click(screen.getByRole("button", { name: "Choose year" }))
    fireEvent.click(screen.getByRole("button", { name: "2028" }))
    fireEvent.click(screen.getByRole("button", { name: "May" }))

    expect(getValues().ym).toBe("2028-05")
  })

  test("disables months and years outside min/max range", () => {
    renderWithForm<{ ym: string }>(
      (control) => (
        <YearMonthField
          name="ym"
          control={control}
          label="Start month"
          min="2026-03"
          max="2026-05"
        />
      ),
      { defaultValues: { ym: "2026-04" } },
    )

    const trigger = screen.getByRole("button", { name: /April 2026/ })
    fireEvent.click(trigger)

    expect(screen.getByRole("button", { name: "February" })).toBeDisabled()
    expect(screen.getByRole("button", { name: "June" })).toBeDisabled()

    fireEvent.click(screen.getByRole("button", { name: "Choose year" }))
    expect(screen.getByRole("button", { name: "2025" })).toBeDisabled()
    expect(screen.getByRole("button", { name: "2027" })).toBeDisabled()
  })

  test("opens with keyboard and closes with escape", () => {
    renderWithForm<{ ym: string }>(
      (control) => <YearMonthField name="ym" control={control} label="Start month" />,
      { defaultValues: { ym: "2026-05" } },
    )

    const trigger = screen.getByRole("button", { name: /May 2026/ })
    fireEvent.focus(trigger)

    fireEvent.keyDown(trigger, { key: "Enter" })
    fireEvent.keyUp(trigger, { key: "Enter" })
    expect(screen.getByText("Choose month")).toBeInTheDocument()

    fireEvent.keyDown(trigger, { key: "Escape" })
    expect(screen.queryByText("Choose month")).not.toBeInTheDocument()
    expect(trigger).toHaveFocus()
  })
})
