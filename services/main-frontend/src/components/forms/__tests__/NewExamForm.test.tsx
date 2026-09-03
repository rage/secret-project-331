"use client"

import "@testing-library/jest-dom"
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react"

import type { NewExam, OrgExam } from "@/generated/api/types.generated"

import NewExamForm from "../NewExamForm"

const FROZEN_NOW = new Date(2026, 0, 15, 10, 30, 0)

/** Opens the calendar for a DateTimeLocalField group and clicks "Now" to commit the current time. */
function pickNow(groupName: string) {
  const group = screen.getByRole("group", { name: groupName })
  fireEvent.click(within(group).getByRole("button"))
  fireEvent.click(screen.getByRole("button", { name: "datePicker.now" }))
  fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" })
}

function fillRequiredNonDateFields() {
  fireEvent.change(document.querySelector('input[name="name"]') as HTMLInputElement, {
    target: { value: "Resit exam" },
  })
  fireEvent.change(document.querySelector('input[name="timeMinutes"]') as HTMLInputElement, {
    target: { value: "60" },
  })
}

describe("NewExamForm", () => {
  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(FROZEN_NOW)
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it("submits freshly picked starts_at and ends_at as full ISO strings", async () => {
    const onCreateNewExam = jest.fn()
    render(
      <NewExamForm
        initialData={null}
        organizationId="org-1"
        exams={[]}
        onCreateNewExam={onCreateNewExam}
        onDuplicateExam={jest.fn()}
        onCancel={jest.fn()}
      />,
    )

    fillRequiredNonDateFields()
    pickNow("label-starts-at")
    jest.setSystemTime(new Date(2026, 0, 15, 11, 0, 0))
    pickNow("label-ends-at")

    fireEvent.click(screen.getByRole("button", { name: "button-text-submit" }))

    await waitFor(() => expect(onCreateNewExam).toHaveBeenCalledTimes(1))
    const submitted = onCreateNewExam.mock.calls[0][0] as NewExam
    expect(submitted.starts_at).toBe(FROZEN_NOW.toISOString())
    expect(submitted.ends_at).toBe(new Date(2026, 0, 15, 11, 0, 0).toISOString())
  })

  it("preserves initialData's starts_at/ends_at when submitted untouched", async () => {
    const onCreateNewExam = jest.fn()
    const initialData: OrgExam = {
      id: "exam-1",
      created_at: "2020-01-01T00:00:00.000Z",
      updated_at: "2020-01-01T00:00:00.000Z",
      instructions: null,
      minimum_points_treshold: 0,
      name: "Original exam",
      organization_id: "org-1",
      time_minutes: 60,
      grade_manually: false,
      starts_at: "2020-06-01T08:15:00.000Z",
      ends_at: "2020-06-01T10:15:00.000Z",
    }
    render(
      <NewExamForm
        initialData={initialData}
        organizationId="org-1"
        exams={[]}
        onCreateNewExam={onCreateNewExam}
        onDuplicateExam={jest.fn()}
        onCancel={jest.fn()}
      />,
    )

    fillRequiredNonDateFields()
    fireEvent.click(screen.getByRole("button", { name: "button-text-submit" }))

    await waitFor(() => expect(onCreateNewExam).toHaveBeenCalledTimes(1))
    const submitted = onCreateNewExam.mock.calls[0][0] as NewExam
    expect(submitted.starts_at).toBe(new Date(initialData.starts_at as string).toISOString())
    expect(submitted.ends_at).toBe(new Date(initialData.ends_at as string).toISOString())
  })
})
