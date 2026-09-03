"use client"

import "@testing-library/jest-dom"
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react"

import type { Exam, NewExam } from "@/generated/api/types.generated"

import EditExamForm from "../EditExamForm"

const FROZEN_NOW = new Date(2026, 0, 15, 10, 30, 0)

/** Opens the calendar for a DateTimeLocalField group and clicks "Now" to commit the current time. */
function pickNow(groupName: string) {
  const group = screen.getByRole("group", { name: groupName })
  fireEvent.click(within(group).getByRole("button"))
  fireEvent.click(screen.getByRole("button", { name: "datePicker.now" }))
  fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" })
}

const initialData: Exam = {
  courses: [],
  id: "exam-1",
  instructions: null,
  language: "en",
  minimum_points_treshold: 0,
  name: "Final exam",
  page_id: "page-1",
  time_minutes: 60,
  grade_manually: false,
  starts_at: "2020-01-01T08:00:00.000Z",
  ends_at: "2030-01-01T08:00:00.000Z",
}

describe("EditExamForm", () => {
  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(FROZEN_NOW)
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it("preserves the initial starts_at and ends_at when submitted untouched", async () => {
    const onEditExam = jest.fn()
    render(
      <EditExamForm
        initialData={initialData}
        organizationId="org-1"
        onEditExam={onEditExam}
        onCancel={jest.fn()}
      />,
    )

    fireEvent.click(screen.getByRole("button", { name: "button-text-submit" }))

    await waitFor(() => expect(onEditExam).toHaveBeenCalledTimes(1))
    const submitted = onEditExam.mock.calls[0][0] as NewExam
    expect(submitted.starts_at).toBe(new Date(initialData.starts_at as string).toISOString())
    expect(submitted.ends_at).toBe(new Date(initialData.ends_at as string).toISOString())
  })

  it("submits a freshly picked starts_at as a full ISO string", async () => {
    const onEditExam = jest.fn()
    render(
      <EditExamForm
        initialData={initialData}
        organizationId="org-1"
        onEditExam={onEditExam}
        onCancel={jest.fn()}
      />,
    )

    pickNow("label-starts-at")
    fireEvent.click(screen.getByRole("button", { name: "button-text-submit" }))

    await waitFor(() => expect(onEditExam).toHaveBeenCalledTimes(1))
    const submitted = onEditExam.mock.calls[0][0] as NewExam
    expect(submitted.starts_at).toBe(FROZEN_NOW.toISOString())
  })
})
