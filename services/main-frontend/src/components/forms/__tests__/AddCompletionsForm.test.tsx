"use client"

import "@testing-library/jest-dom"
import { resetLocalTimeZone, setLocalTimeZone } from "@internationalized/date"
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react"

import type { CourseModule, TeacherManualCompletionRequest } from "@/generated/api/types.generated"

import AddCompletionsForm from "../AddCompletionsForm"

const COURSE_MODULE = { id: "module-1", name: "Module 1" } as unknown as CourseModule

describe("AddCompletionsForm", () => {
  it("applies the picked date to rows that don't specify their own completion date", async () => {
    const onSubmit = jest.fn()
    render(<AddCompletionsForm courseModules={[COURSE_MODULE]} onSubmit={onSubmit} />)

    fireEvent.click(screen.getByRole("button", { name: /label-course-module/ }))
    fireEvent.click(screen.getByRole("option", { name: "Module 1" }))

    // Fake time only around picking "today" from the DateField calendar, so the resulting
    // committed date is deterministic regardless of when this test actually runs.
    jest.useFakeTimers()
    jest.setSystemTime(new Date("2026-03-13T12:00:00Z"))
    setLocalTimeZone("UTC")
    try {
      fireEvent.click(within(screen.getByRole("group", { name: "date" })).getByRole("button"))
      // The mocked react-i18next in tests/setup-jest.js returns the key, not the string, so the
      // DateField calendar's quick-action button reads as its i18n key here.
      fireEvent.click(screen.getByRole("button", { name: "datePicker.today" }))
    } finally {
      resetLocalTimeZone()
      jest.useRealTimers()
    }

    fireEvent.change(screen.getByRole("textbox", { name: /label-csv/ }), {
      target: { value: "user_id,grade\nuser-1,5" },
    })

    fireEvent.click(screen.getByRole("button", { name: "button-text-submit" }))

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1))
    const submitted = onSubmit.mock.calls[0][0] as TeacherManualCompletionRequest
    expect(submitted.course_module_id).toBe("module-1")
    expect(submitted.new_completions).toEqual([
      {
        user_id: "user-1",
        grade: 5,
        completion_date: "2026-03-13T12:00:00+00:00",
        passed: true,
      },
    ])
  })

  it("prefers a row's own completion date over the picked default", async () => {
    const onSubmit = jest.fn()
    render(<AddCompletionsForm courseModules={[COURSE_MODULE]} onSubmit={onSubmit} />)

    fireEvent.click(screen.getByRole("button", { name: /label-course-module/ }))
    fireEvent.click(screen.getByRole("option", { name: "Module 1" }))

    fireEvent.change(screen.getByRole("textbox", { name: /label-csv/ }), {
      target: { value: "user_id,grade,completion_date\nuser-1,pass,2024-03-15" },
    })

    fireEvent.click(screen.getByRole("button", { name: "button-text-submit" }))

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1))
    const submitted = onSubmit.mock.calls[0][0] as TeacherManualCompletionRequest
    expect(submitted.new_completions).toEqual([
      {
        user_id: "user-1",
        grade: null,
        completion_date: "2024-03-15T12:00:00+00:00",
        passed: true,
      },
    ])
  })
})
