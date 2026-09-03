"use client"

import "@testing-library/jest-dom"
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import type { DefaultValues } from "react-hook-form"
import { FormProvider, useForm } from "react-hook-form"

import { formatDateForDateTimeLocalInputs } from "@/shared-module/common/utils/time"

import type { EditCourseFormValues } from ".."
import ClosedSectionFields from "../ClosedSectionFields"

const FROZEN_NOW = new Date(2026, 0, 15, 10, 30, 0)

/** Opens the calendar for a DateTimeLocalField group and clicks "Now" to commit the current time. */
function pickNow(groupName: string) {
  const group = screen.getByRole("group", { name: groupName })
  fireEvent.click(within(group).getByRole("button"))
  fireEvent.click(screen.getByRole("button", { name: "datePicker.now" }))
  fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" })
}

function Harness({
  onSubmit,
  defaultValues,
}: {
  onSubmit: (data: EditCourseFormValues) => void
  defaultValues: DefaultValues<EditCourseFormValues>
}) {
  const methods = useForm<EditCourseFormValues>({ defaultValues })
  return (
    <FormProvider {...methods}>
      <form onSubmit={methods.handleSubmit(onSubmit)}>
        <ClosedSectionFields />
        <button type="submit">submit</button>
      </form>
    </FormProvider>
  )
}

describe("ClosedSectionFields", () => {
  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(FROZEN_NOW)
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it("auto-fills closed_at with the current time when checked from empty, in a shape the submit mapping can parse", async () => {
    const onSubmit = jest.fn()
    render(
      <Harness
        onSubmit={onSubmit}
        defaultValues={{ set_course_closed_at: false, closed_at: null }}
      />,
    )

    fireEvent.click(screen.getByRole("checkbox", { name: "set-course-closed-at" }))
    fireEvent.click(screen.getByRole("button", { name: "submit" }))

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1))
    const data = onSubmit.mock.calls[0][0] as EditCourseFormValues
    expect(data.set_course_closed_at).toBe(true)
    expect(data.closed_at).toBe(formatDateForDateTimeLocalInputs(FROZEN_NOW))
    expect(new Date(data.closed_at as string).toISOString()).toBe(FROZEN_NOW.toISOString())
  })

  it("commits a picked closed_at value in the same shape the submit mapping expects", async () => {
    const onSubmit = jest.fn()
    render(
      <Harness
        onSubmit={onSubmit}
        defaultValues={{
          set_course_closed_at: true,
          closed_at: "2020-01-01T00:00",
        }}
      />,
    )

    pickNow("closed-at")
    fireEvent.click(screen.getByRole("button", { name: "submit" }))

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1))
    const data = onSubmit.mock.calls[0][0] as EditCourseFormValues
    expect(new Date(data.closed_at as string).toISOString()).toBe(FROZEN_NOW.toISOString())
  })
})
