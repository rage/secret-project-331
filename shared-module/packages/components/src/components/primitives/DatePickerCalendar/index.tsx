"use client"

import { cx } from "@emotion/css"
import { createCalendar, toCalendar, today } from "@internationalized/date"
import { useCalendarState } from "@react-stately/calendar"
import React from "react"
import { useCalendar, useDateFormatter, useDialog, useLocale } from "react-aria"

import { YearMonthPicker } from "../YearMonthPicker"

import { CalendarGrid } from "./CalendarGrid"
import { CalendarNavButton } from "./CalendarNavButton"
import { HybridTimeSelector } from "./HybridTimeSelector"
import {
  chooseMonthYearLabel,
  clearLabel,
  leftDirection,
  longDateTimePart,
  nextMonthLabel,
  nextWeekLabel,
  nowLabel,
  numericDateTimePart,
  pickerViewCalendar,
  pickerViewMonth,
  pickerViewYear,
  previousMonthLabel,
  rightDirection,
  todayLabel,
  tomorrowLabel,
} from "./datePickerCalendarConstants"
import {
  calendarHeaderCenterCss,
  calendarHeaderCss,
  calendarPanelCss,
  dialogCss,
  monthYearLinkCss,
  monthYearSeparatorCss,
  pickerLayoutCss,
  pickerLayoutWithTimeCss,
  pickerRootCss,
  quickActionChipCss,
  quickActionsCss,
} from "./datePickerCalendarStyles"
import type { CalendarPickerView, DatePickerCalendarProps } from "./datePickerCalendarTypes"

export type { DatePickerCalendarProps } from "./datePickerCalendarTypes"

/** Calendar popover body for date and datetime segmented fields. */
export function DatePickerCalendar({
  calendarProps,
  canClear,
  dialogProps,
  onClear,
  onSelectNextWeek,
  onSelectNow,
  onSelectToday,
  onSelectTomorrow,
  timeSelectorProps,
}: DatePickerCalendarProps) {
  const ref = React.useRef<HTMLDivElement>(null)
  const { dialogProps: resolvedDialogProps } = useDialog(dialogProps, ref)
  const { locale } = useLocale()
  const [pickerView, setPickerView] = React.useState<CalendarPickerView>(pickerViewCalendar)
  const state = useCalendarState({
    ...calendarProps,
    createCalendar,
    locale,
  })
  const { calendarProps: calendarAriaProps } = useCalendar(calendarProps, state)
  const monthFormatter = useDateFormatter({
    calendar: state.visibleRange.start.calendar.identifier,
    month: longDateTimePart,
    timeZone: state.timeZone,
  })
  const yearFormatter = useDateFormatter({
    calendar: state.visibleRange.start.calendar.identifier,
    timeZone: state.timeZone,
    year: numericDateTimePart,
  })
  const isInteractive = !(calendarProps.isDisabled || calendarProps.isReadOnly)
  const visibleMonthLabel = monthFormatter.format(state.visibleRange.start.toDate(state.timeZone))
  const visibleYearLabel = yearFormatter.format(state.visibleRange.start.toDate(state.timeZone))
  const openYearPicker = () => {
    setPickerView(pickerViewYear)
  }

  return (
    <div {...resolvedDialogProps} ref={ref} className={cx(dialogCss, pickerRootCss)}>
      <div
        {...calendarAriaProps}
        className={cx(
          pickerLayoutCss,
          timeSelectorProps && pickerView === pickerViewCalendar
            ? pickerLayoutWithTimeCss
            : undefined,
        )}
      >
        {pickerView === pickerViewCalendar ? (
          <>
            <div className={calendarPanelCss}>
              <div className={calendarHeaderCss}>
                <CalendarNavButton
                  direction={leftDirection}
                  isDisabled={state.isPreviousVisibleRangeInvalid()}
                  label={previousMonthLabel}
                  onPress={() => state.focusPreviousPage()}
                />
                <div className={calendarHeaderCenterCss}>
                  <button
                    aria-label={`${chooseMonthYearLabel}: ${visibleMonthLabel}`}
                    className={monthYearLinkCss}
                    disabled={!isInteractive}
                    type="button"
                    onClick={() => setPickerView(pickerViewMonth)}
                  >
                    {visibleMonthLabel}
                  </button>
                  <span aria-hidden="true" className={monthYearSeparatorCss}>
                    {" "}
                  </span>
                  <button
                    aria-label={`${chooseMonthYearLabel}: ${visibleYearLabel}`}
                    className={monthYearLinkCss}
                    disabled={!isInteractive}
                    type="button"
                    onClick={openYearPicker}
                  >
                    {visibleYearLabel}
                  </button>
                </div>
                <CalendarNavButton
                  direction={rightDirection}
                  isDisabled={state.isNextVisibleRangeInvalid()}
                  label={nextMonthLabel}
                  onPress={() => state.focusNextPage()}
                />
              </div>

              <CalendarGrid firstDayOfWeek={calendarProps.firstDayOfWeek} state={state} />

              <div className={quickActionsCss}>
                <button
                  className={quickActionChipCss}
                  disabled={!canClear || !isInteractive}
                  type="button"
                  onClick={onClear}
                >
                  {clearLabel}
                </button>
                {timeSelectorProps ? (
                  <button
                    className={quickActionChipCss}
                    disabled={!isInteractive || !onSelectNow}
                    type="button"
                    onClick={() => onSelectNow?.()}
                  >
                    {nowLabel}
                  </button>
                ) : (
                  <button
                    className={quickActionChipCss}
                    disabled={!isInteractive}
                    type="button"
                    onClick={() => {
                      const todayDate = toCalendar(
                        today(state.timeZone),
                        state.visibleRange.start.calendar,
                      )
                      state.setFocusedDate(todayDate)
                      onSelectToday(todayDate)
                    }}
                  >
                    {todayLabel}
                  </button>
                )}
                {onSelectTomorrow ? (
                  <button
                    className={quickActionChipCss}
                    disabled={!isInteractive}
                    type="button"
                    onClick={() => {
                      const base = toCalendar(
                        today(state.timeZone),
                        state.visibleRange.start.calendar,
                      )
                      const next = base.add({ days: 1 })
                      state.setFocusedDate(next)
                      onSelectTomorrow(next)
                    }}
                  >
                    {tomorrowLabel}
                  </button>
                ) : null}
                {onSelectNextWeek ? (
                  <button
                    className={quickActionChipCss}
                    disabled={!isInteractive}
                    type="button"
                    onClick={() => {
                      const base = toCalendar(
                        today(state.timeZone),
                        state.visibleRange.start.calendar,
                      )
                      const next = base.add({ weeks: 1 })
                      state.setFocusedDate(next)
                      onSelectNextWeek(next)
                    }}
                  >
                    {nextWeekLabel}
                  </button>
                ) : null}
              </div>
            </div>

            {timeSelectorProps ? (
              <HybridTimeSelector timeSelectorProps={timeSelectorProps} />
            ) : null}
          </>
        ) : null}

        {pickerView !== pickerViewCalendar ? (
          <YearMonthPicker
            // eslint-disable-next-line i18next/no-literal-string
            initialView={pickerView === pickerViewYear ? "year" : "month"}
            selectedYear={state.visibleRange.start.year}
            selectedMonth={state.visibleRange.start.month}
            minYear={calendarProps.minValue?.year}
            minMonth={calendarProps.minValue?.month}
            maxYear={calendarProps.maxValue?.year}
            maxMonth={calendarProps.maxValue?.month}
            isDisabled={calendarProps.isDisabled}
            isReadOnly={calendarProps.isReadOnly}
            locale={locale}
            onSelect={(year, month) => {
              const nextDate = state.focusedDate.set({ year, month, day: 1 })
              state.setFocusedDate(nextDate)
              setPickerView(pickerViewCalendar)
            }}
            onCancel={() => setPickerView(pickerViewCalendar)}
          />
        ) : null}
      </div>
    </div>
  )
}
