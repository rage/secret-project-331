"use client"

import { cx } from "@emotion/css"
import { createCalendar, toCalendar, today } from "@internationalized/date"
import { useCalendarState } from "@react-stately/calendar"
import React from "react"
import { useCalendar, useDateFormatter, useDialog, useLocale } from "react-aria"

import { CalendarGrid } from "./CalendarGrid"
import { CalendarNavButton } from "./CalendarNavButton"
import { ChevronIcon } from "./ChevronIcon"
import { ChooserGridSection } from "./ChooserGridSection"
import { HybridTimeSelector } from "./HybridTimeSelector"
import {
  backToCalendarLabel,
  chooseMonthYearLabel,
  clearLabel,
  leftDirection,
  longDateTimePart,
  monthIdPrefix,
  nextMonthLabel,
  nextWeekLabel,
  nextYearsLabel,
  nowLabel,
  numericDateTimePart,
  pickerViewCalendar,
  pickerViewMonth,
  pickerViewYear,
  pickMonthTitle,
  pickYearTitle,
  previousMonthLabel,
  previousYearsLabel,
  rightDirection,
  todayLabel,
  tomorrowLabel,
  yearColumnLabel,
  yearIdPrefix,
} from "./datePickerCalendarConstants"
import {
  calendarHeaderCenterCss,
  calendarHeaderCss,
  calendarNavButtonCss,
  calendarPanelCss,
  chooserPagerCss,
  chooserPanelCss,
  chooserTitleCss,
  dialogCss,
  inlinePickerHeaderCss,
  monthYearLinkCss,
  monthYearSeparatorCss,
  pickerLayoutCss,
  pickerLayoutWithTimeCss,
  pickerRootCss,
  quickActionChipCss,
  quickActionsCss,
} from "./datePickerCalendarStyles"
import { getYearPageStart } from "./datePickerCalendarTimeUtils"
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
  const [draftYear, setDraftYear] = React.useState(state.visibleRange.start.year)
  const [yearPageStart, setYearPageStart] = React.useState(
    getYearPageStart(state.visibleRange.start.year),
  )
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
  const monthOptions = Array.from(
    { length: state.visibleRange.start.calendar.getMonthsInYear(state.visibleRange.start) },
    (_, index) => {
      const value = index + 1
      const date = state.visibleRange.start.set({ day: 1, month: value, year: draftYear })

      return {
        label: monthFormatter.format(date.toDate(state.timeZone)),
        value,
      }
    },
  )
  const isInteractive = !(calendarProps.isDisabled || calendarProps.isReadOnly)
  const visibleMonthLabel = monthFormatter.format(state.visibleRange.start.toDate(state.timeZone))
  const visibleYearLabel = yearFormatter.format(state.visibleRange.start.toDate(state.timeZone))
  const chooserYears = Array.from({ length: 12 }, (_, index) => yearPageStart + index)
  const yearGridOptions = chooserYears.map((year) => ({
    id: `${yearIdPrefix}${year}`,
    isSelected: year === state.visibleRange.start.year,
    label: String(year),
    onSelect: () => {
      const nextDate = state.focusedDate.set({ year })
      state.setFocusedDate(nextDate)
      setDraftYear(year)
      setYearPageStart(getYearPageStart(year))
      setPickerView(pickerViewCalendar)
    },
  }))
  const monthGridOptions = monthOptions.map((option) => ({
    id: `${monthIdPrefix}${option.value}`,
    isSelected: option.value === state.visibleRange.start.month,
    label: option.label,
    onSelect: () => {
      const nextDate = state.focusedDate.set({
        day: 1,
        month: option.value,
        year: draftYear,
      })
      state.setFocusedDate(nextDate)
      setPickerView(pickerViewCalendar)
    },
  }))

  const openMonthPicker = () => {
    setDraftYear(state.visibleRange.start.year)
    setPickerView(pickerViewMonth)
  }

  const openYearPicker = () => {
    const year = state.visibleRange.start.year
    setDraftYear(year)
    setYearPageStart(getYearPageStart(year))
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
                    onClick={openMonthPicker}
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

        {pickerView === pickerViewMonth ? (
          <div className={chooserPanelCss}>
            <div className={inlinePickerHeaderCss}>
              <button
                aria-label={backToCalendarLabel}
                className={calendarNavButtonCss}
                disabled={!isInteractive}
                type="button"
                onClick={() => setPickerView(pickerViewCalendar)}
              >
                <ChevronIcon direction={leftDirection} />
              </button>
              <div className={chooserTitleCss}>{pickMonthTitle}</div>
              <span aria-hidden="true" />
            </div>
            <ChooserGridSection isDisabled={!isInteractive} options={monthGridOptions} />
          </div>
        ) : null}

        {pickerView === pickerViewYear ? (
          <div className={chooserPanelCss}>
            <div className={inlinePickerHeaderCss}>
              <button
                aria-label={backToCalendarLabel}
                className={calendarNavButtonCss}
                disabled={!isInteractive}
                type="button"
                onClick={() => setPickerView(pickerViewCalendar)}
              >
                <ChevronIcon direction={leftDirection} />
              </button>
              <div className={chooserTitleCss}>{pickYearTitle}</div>
              <div className={chooserPagerCss}>
                <CalendarNavButton
                  direction={leftDirection}
                  isDisabled={!isInteractive}
                  label={previousYearsLabel}
                  onPress={() => setYearPageStart((current) => Math.max(1, current - 12))}
                />
                <CalendarNavButton
                  direction={rightDirection}
                  isDisabled={!isInteractive}
                  label={nextYearsLabel}
                  onPress={() => setYearPageStart((current) => current + 12)}
                />
              </div>
            </div>
            <ChooserGridSection
              isDisabled={!isInteractive}
              label={yearColumnLabel}
              options={yearGridOptions}
            />
          </div>
        ) : null}
      </div>
    </div>
  )
}
