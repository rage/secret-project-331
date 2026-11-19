"use client"

import "@testing-library/jest-dom"
import { resetLocalTimeZone, setLocalTimeZone } from "@internationalized/date"
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react"

import LineChart, { CUSTOM_PERIOD } from "../LineChart"

/** Opens a DateField's calendar and commits "today", matching the mocked react-i18next key. */
function pickToday(groupName: string) {
  const group = screen.getByRole("group", { name: groupName })
  fireEvent.click(within(group).getByRole("button"))
  fireEvent.click(screen.getByRole("button", { name: "datePicker.today" }))
}

describe("LineChart custom date range", () => {
  it("forwards picked start and end dates to the caller's state setters", async () => {
    jest.useFakeTimers()
    jest.setSystemTime(new Date("2026-03-13T12:00:00Z"))
    setLocalTimeZone("UTC")

    const setStartDate = jest.fn()
    const setEndDate = jest.fn()

    try {
      render(
        <LineChart
          data={undefined}
          isLoading={false}
          error={null}
          period={CUSTOM_PERIOD}
          setPeriod={jest.fn()}
          yAxisName="y"
          tooltipValueLabel="value"
          dateFormat="yyyy-MM-dd"
          statHeading="heading"
          instructionText="instructions"
          showCustomTimePeriodSelector={true}
          setStartDate={setStartDate}
          setEndDate={setEndDate}
        />,
      )

      pickToday("stats-start-date")
      await waitFor(() => expect(setStartDate).toHaveBeenCalledWith("2026-03-13"))

      pickToday("stats-end-date")
      await waitFor(() => expect(setEndDate).toHaveBeenCalledWith("2026-03-13"))
    } finally {
      resetLocalTimeZone()
      jest.useRealTimers()
    }
  })

  it("does not render the custom date fields outside the custom period", () => {
    render(
      <LineChart
        data={undefined}
        isLoading={false}
        error={null}
        period="Month"
        setPeriod={jest.fn()}
        yAxisName="y"
        tooltipValueLabel="value"
        dateFormat="yyyy-MM-dd"
        statHeading="heading"
        instructionText="instructions"
        showCustomTimePeriodSelector={true}
      />,
    )

    expect(screen.queryByRole("group", { name: "stats-start-date" })).not.toBeInTheDocument()
    expect(screen.queryByRole("group", { name: "stats-end-date" })).not.toBeInTheDocument()
  })
})
