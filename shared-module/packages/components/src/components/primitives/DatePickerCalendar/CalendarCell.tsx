"use client"

import { cx } from "@emotion/css"
import { isSameMonth, isToday } from "@internationalized/date"
import type { useCalendarState } from "@react-stately/calendar"
import React from "react"
import { useCalendarCell } from "react-aria"

import {
  calendarCellButtonCss,
  calendarCellCss,
  calendarCellDisabledCss,
  calendarCellInvalidCss,
  calendarCellKeyboardFocusCss,
  calendarCellOutsideMonthCss,
  calendarCellSelectedCss,
  calendarCellSelectedKeyboardFocusCss,
  calendarCellTodayKeyboardFocusCss,
  calendarCellTodayOnlyCss,
  calendarCellUnavailableCss,
} from "./datePickerCalendarStyles"

/** Renders one day cell in the calendar grid. */
export function CalendarCell({
  date,
  monthStart,
  state,
}: {
  date: ReturnType<typeof useCalendarState>["visibleRange"]["start"]
  monthStart: ReturnType<typeof useCalendarState>["visibleRange"]["start"]
  state: ReturnType<typeof useCalendarState>
}) {
  const ref = React.useRef<HTMLButtonElement>(null)
  const isOutsideMonth = !isSameMonth(date, monthStart)
  const {
    cellProps,
    buttonProps,
    formattedDate,
    isDisabled,
    isFocused,
    isInvalid,
    isSelected,
    isUnavailable,
  } = useCalendarCell(
    {
      date,
      isOutsideMonth,
    },
    state,
    ref,
  )
  const isTodayDate = isToday(date, state.timeZone)

  return (
    <td {...cellProps} className={calendarCellCss}>
      <button
        {...buttonProps}
        ref={ref}
        className={cx(
          calendarCellButtonCss,
          isSelected ? calendarCellSelectedCss : undefined,
          isSelected && isFocused ? calendarCellSelectedKeyboardFocusCss : undefined,
          !isSelected && isFocused && isTodayDate ? calendarCellTodayKeyboardFocusCss : undefined,
          !isSelected && isFocused && !isTodayDate ? calendarCellKeyboardFocusCss : undefined,
          !isSelected && !isFocused && isTodayDate ? calendarCellTodayOnlyCss : undefined,
          isOutsideMonth ? calendarCellOutsideMonthCss : undefined,
          isUnavailable ? calendarCellUnavailableCss : undefined,
          isDisabled ? calendarCellDisabledCss : undefined,
          isInvalid ? calendarCellInvalidCss : undefined,
        )}
        type="button"
      >
        {formattedDate}
      </button>
    </td>
  )
}
