"use client"

import type { useCalendarState } from "@react-stately/calendar"
import { useCalendarGrid } from "react-aria"
import type { CalendarProps, DateValue } from "react-aria"

import { CalendarCell } from "./CalendarCell"
import {
  calendarEmptyCellCss,
  calendarGridCss,
  calendarWeekdayCss,
} from "./datePickerCalendarStyles"

/** Renders the weekday header and weeks grid for the visible month. */
export function CalendarGrid({
  firstDayOfWeek,
  state,
}: {
  firstDayOfWeek?: CalendarProps<DateValue>["firstDayOfWeek"]
  state: ReturnType<typeof useCalendarState>
}) {
  const { gridProps, headerProps, weekDays, weeksInMonth } = useCalendarGrid(
    { firstDayOfWeek },
    state,
  )
  const monthStart = state.visibleRange.start

  return (
    <table {...gridProps} className={calendarGridCss}>
      <thead {...headerProps}>
        <tr>
          {weekDays.map((day, index) => (
            <th key={`${day}-${index}`} className={calendarWeekdayCss}>
              {day}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {Array.from({ length: weeksInMonth }, (_, weekIndex) => (
          <tr key={weekIndex}>
            {state
              .getDatesInWeek(weekIndex)
              .map((date, dayIndex) =>
                date ? (
                  <CalendarCell
                    key={date.toString()}
                    date={date}
                    monthStart={monthStart}
                    state={state}
                  />
                ) : (
                  <td key={`empty-${weekIndex}-${dayIndex}`} className={calendarEmptyCellCss} />
                ),
              )}
          </tr>
        ))}
      </tbody>
    </table>
  )
}
