"use client"

import "@testing-library/jest-dom"
import { resetLocalTimeZone, setLocalTimeZone } from "@internationalized/date"
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react"

import TotalStats from "../TotalStats"

const idleQueryResult = { data: undefined, isLoading: false, error: null }

const useTotalUsersStartedCourseQueryCustomTimePeriod = jest.fn(() => idleQueryResult)
const useTotalUsersReturnedExercisesQueryCustomTimePeriod = jest.fn(() => idleQueryResult)
const useTotalUsersCompletedCourseQueryCustomTimePeriod = jest.fn(() => idleQueryResult)

jest.mock("@/hooks/stats", () => ({
  useTotalUsersStartedCourseQuery: () => idleQueryResult,
  useTotalUsersReturnedExercisesQuery: () => idleQueryResult,
  useTotalUsersCompletedCourseQuery: () => idleQueryResult,
  useTotalUsersStartedCourseQueryCustomTimePeriod: (
    ...args: Parameters<typeof useTotalUsersStartedCourseQueryCustomTimePeriod>
  ) => useTotalUsersStartedCourseQueryCustomTimePeriod(...args),
  useTotalUsersReturnedExercisesQueryCustomTimePeriod: (
    ...args: Parameters<typeof useTotalUsersReturnedExercisesQueryCustomTimePeriod>
  ) => useTotalUsersReturnedExercisesQueryCustomTimePeriod(...args),
  useTotalUsersCompletedCourseQueryCustomTimePeriod: (
    ...args: Parameters<typeof useTotalUsersCompletedCourseQueryCustomTimePeriod>
  ) => useTotalUsersCompletedCourseQueryCustomTimePeriod(...args),
}))

/** Opens a DateField's calendar and commits "today", matching the mocked react-i18next key. */
function pickToday(groupName: string) {
  const group = screen.getByRole("group", { name: groupName })
  fireEvent.click(within(group).getByRole("button"))
  fireEvent.click(screen.getByRole("button", { name: "datePicker.today" }))
}

describe("TotalStats custom date range", () => {
  it("queries the custom time period with the picked start and end dates", async () => {
    jest.useFakeTimers()
    jest.setSystemTime(new Date("2026-03-13T12:00:00Z"))
    setLocalTimeZone("UTC")

    try {
      render(<TotalStats courseId="course-1" />)

      fireEvent.change(screen.getByRole("combobox"), { target: { value: "custom" } })

      pickToday("stats-start-date")
      pickToday("stats-end-date")

      await waitFor(() =>
        expect(useTotalUsersStartedCourseQueryCustomTimePeriod).toHaveBeenLastCalledWith(
          "course-1",
          "2026-03-13",
          "2026-03-13",
          { enabled: true },
        ),
      )
      expect(useTotalUsersReturnedExercisesQueryCustomTimePeriod).toHaveBeenLastCalledWith(
        "course-1",
        "2026-03-13",
        "2026-03-13",
        { enabled: true },
      )
      expect(useTotalUsersCompletedCourseQueryCustomTimePeriod).toHaveBeenLastCalledWith(
        "course-1",
        "2026-03-13",
        "2026-03-13",
        { enabled: true },
      )
    } finally {
      resetLocalTimeZone()
      jest.useRealTimers()
    }
  })

  it("leaves the custom time period disabled until both dates are picked", () => {
    render(<TotalStats courseId="course-1" />)

    fireEvent.change(screen.getByRole("combobox"), { target: { value: "custom" } })

    expect(useTotalUsersStartedCourseQueryCustomTimePeriod).toHaveBeenLastCalledWith(
      "course-1",
      "",
      "",
      { enabled: false },
    )
  })
})
