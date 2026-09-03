"use client"

import "@testing-library/jest-dom"
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react"

import type { CourseInstanceForm } from "@/generated/api/types.generated"

import NewCourseInstanceForm from "../NewCourseInstanceForm"

/** Opens the calendar for a DateTimeLocalField group and clicks "Now" to commit the current time. */
function pickNow(groupName: string) {
  const group = screen.getByRole("group", { name: groupName })
  fireEvent.click(within(group).getByRole("button"))
  fireEvent.click(screen.getByRole("button", { name: "datePicker.now" }))
  // Picking a time does not auto-close the popover (only whole-date selection does), so close it
  // explicitly before interacting with the next field.
  fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" })
}

describe("NewCourseInstanceForm", () => {
  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date(2026, 0, 15, 10, 30, 0))
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it("submits opening and closing times as full ISO strings", async () => {
    const onSubmit = jest.fn()
    render(<NewCourseInstanceForm initialData={null} onSubmit={onSubmit} onCancel={jest.fn()} />)

    pickNow("opening-time")
    pickNow("closing-time")

    fireEvent.click(screen.getByRole("button", { name: "button-text-submit" }))

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1))
    const submitted = onSubmit.mock.calls[0][0] as CourseInstanceForm
    expect(submitted.opening_time).toBe(new Date(2026, 0, 15, 10, 30, 0).toISOString())
    expect(submitted.closing_time).toBe(new Date(2026, 0, 15, 10, 30, 0).toISOString())
  })

  it("submits null for opening and closing times when left untouched", async () => {
    const onSubmit = jest.fn()
    render(<NewCourseInstanceForm initialData={null} onSubmit={onSubmit} onCancel={jest.fn()} />)

    fireEvent.click(screen.getByRole("button", { name: "button-text-submit" }))

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1))
    const submitted = onSubmit.mock.calls[0][0] as CourseInstanceForm
    expect(submitted.opening_time).toBeNull()
    expect(submitted.closing_time).toBeNull()
  })
})
