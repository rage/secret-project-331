"use client"

import { css, cx } from "@emotion/css"
import {
  createCalendar,
  isSameMonth,
  isToday,
  parseTime,
  Time,
  toCalendar,
  today,
} from "@internationalized/date"
import { useCalendarState } from "@react-stately/calendar"
import React, { useId } from "react"
import {
  useButton,
  useCalendar,
  useCalendarCell,
  useCalendarGrid,
  useDateFormatter,
  useDialog,
  useLocale,
} from "react-aria"
import type { AriaDialogProps, CalendarProps, DateValue, TimeValue } from "react-aria"

const dialogCss = css`
  outline: none;
`

const pickerRootCss = css`
  --picker-accent-bg: var(--color-green-600);
  --picker-accent-fg: var(--color-primary-100);
  --picker-accent-soft: var(--color-green-75);
  --picker-accent-hover: var(--color-green-50);
  --picker-focus-ring: rgba(31, 105, 100, 0.4);
  --picker-focus-ring-strong: rgba(31, 105, 100, 0.55);
  font-family:
    system-ui,
    -apple-system,
    "Segoe UI",
    Roboto,
    sans-serif;
`

const pickerLayoutCss = css`
  display: grid;
  width: 100%;
  box-sizing: border-box;
  gap: var(--space-3);
  padding: var(--space-3);
`

const pickerLayoutWithTimeCss = css`
  grid-template-columns: minmax(0, 1fr) minmax(200px, 240px);
  align-items: stretch;
  column-gap: var(--space-3);
`

const calendarPanelCss = css`
  display: grid;
  gap: var(--space-2);
  min-width: 0;
`

const calendarHeaderCss = css`
  display: grid;
  grid-template-columns: 32px minmax(0, 1fr) 32px;
  align-items: center;
  column-gap: var(--space-1);
  width: 100%;
`

const calendarHeaderCenterCss = css`
  min-width: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-1);
  flex-wrap: wrap;
  justify-self: center;
`

const monthYearLinkCss = css`
  padding: 6px 8px;
  margin: 0;
  border: 0;
  border-radius: var(--control-radius);
  background: transparent;
  color: var(--field-fg);
  cursor: pointer;
  font: inherit;
  font-size: 0.9375rem;
  font-weight: 600;
  line-height: 1.2;

  &:focus-visible {
    outline: none;
    box-shadow: 0 0 0 var(--focus-ring-width) var(--picker-focus-ring);
  }

  &:disabled {
    color: var(--field-disabled-fg);
    cursor: not-allowed;
  }

  &:hover:not(:disabled) {
    background: var(--picker-accent-hover);
  }
`

const monthYearSeparatorCss = css`
  color: var(--field-description);
  font-weight: 500;
  font-size: 0.875rem;
  user-select: none;
`

const calendarNavButtonCss = css`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  padding: 0;
  border: 0;
  border-radius: 999px;
  background: transparent;
  color: var(--field-chrome);
  cursor: pointer;
  transition:
    background-color 0.18s ease,
    color 0.18s ease;

  &:focus-visible {
    outline: none;
    background: var(--picker-accent-soft);
    color: var(--color-green-800);
    box-shadow: 0 0 0 var(--focus-ring-width) var(--picker-focus-ring);
  }

  &:disabled {
    color: var(--field-disabled-fg);
    cursor: not-allowed;
  }

  &:hover:not(:disabled) {
    background: var(--picker-accent-soft);
    color: var(--color-green-800);
  }
`

const calendarNavIconCss = css`
  width: 12px;
  height: 12px;
`

const calendarGridCss = css`
  width: 100%;
  border-collapse: collapse;
  table-layout: fixed;
`

const calendarWeekdayCss = css`
  padding: 0 0 var(--space-1);
  color: var(--field-description);
  font-size: 0.6875rem;
  font-weight: 500;
  line-height: 1.2;
  text-align: center;
`

const calendarCellCss = css`
  padding: var(--space-1);
  text-align: center;
`

const calendarEmptyCellCss = css`
  height: 42px;
`

const calendarCellButtonCss = css`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  padding: 0;
  border: 0;
  border-radius: var(--control-radius);
  background: transparent;
  color: var(--field-fg);
  cursor: pointer;
  font: inherit;
  font-variant-numeric: tabular-nums;
  line-height: 1;
  transition:
    background-color 0.18s ease,
    color 0.18s ease,
    box-shadow 0.18s ease;

  &:disabled {
    cursor: not-allowed;
  }

  &:hover:not(:disabled) {
    background: var(--picker-accent-hover);
  }
`

/** Today, not selected, not keyboard-focused */
const calendarCellTodayOnlyCss = css`
  box-shadow: inset 0 0 0 1px var(--color-green-500);
`

/** Keyboard focus, not selected, not today */
const calendarCellKeyboardFocusCss = css`
  box-shadow: 0 0 0 2px var(--picker-focus-ring-strong);
`

/** Today + keyboard focus, not selected */
const calendarCellTodayKeyboardFocusCss = css`
  box-shadow:
    inset 0 0 0 1px var(--color-green-500),
    0 0 0 2px var(--picker-focus-ring-strong);
`

const calendarCellSelectedCss = css`
  background: var(--picker-accent-bg);
  color: var(--picker-accent-fg);
  font-weight: 600;

  &:hover:not(:disabled) {
    background: var(--picker-accent-bg);
    color: var(--picker-accent-fg);
  }
`

/** Selected + keyboard focus */
const calendarCellSelectedKeyboardFocusCss = css`
  box-shadow:
    0 0 0 2px var(--field-bg),
    0 0 0 4px var(--picker-focus-ring-strong);
`

const calendarCellOutsideMonthCss = css`
  color: var(--field-placeholder);
`

const calendarCellUnavailableCss = css`
  color: var(--field-description);
  text-decoration: line-through;
`

const calendarCellDisabledCss = css`
  color: var(--field-disabled-fg);
`

const calendarCellInvalidCss = css`
  box-shadow: inset 0 0 0 1px var(--field-error-border);
`

const quickActionsCss = css`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-2);
  padding-top: var(--space-2);
  margin-top: var(--space-1);
  border-top: 1px solid rgba(0, 0, 0, 0.06);
`

const quickActionChipCss = css`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 28px;
  padding: 4px 10px;
  border: 1px solid var(--color-green-200);
  border-radius: 999px;
  background: var(--picker-accent-hover);
  color: var(--color-green-800);
  cursor: pointer;
  font: inherit;
  font-size: 0.75rem;
  font-weight: 500;
  line-height: 1.2;
  transition:
    background-color 0.18s ease,
    border-color 0.18s ease,
    color 0.18s ease,
    box-shadow 0.18s ease;

  &:focus-visible {
    outline: none;
    box-shadow: 0 0 0 var(--focus-ring-width) var(--picker-focus-ring);
  }

  &:disabled {
    border-color: var(--field-disabled-border);
    background: var(--field-disabled-bg);
    color: var(--field-disabled-fg);
    cursor: not-allowed;
  }

  &:hover:not(:disabled) {
    background: var(--picker-accent-soft);
    border-color: var(--color-green-300);
    color: var(--color-green-900);
  }
`

const chooserPanelCss = css`
  display: grid;
  gap: var(--space-3);
  min-width: 0;
  width: 100%;
`

const chooserTitleCss = css`
  color: var(--color-gray-400);
  font-size: 0.6875rem;
  font-weight: 500;
  line-height: 1.25;
  text-align: center;
  letter-spacing: 0.02em;
`

const inlinePickerHeaderCss = css`
  display: grid;
  grid-template-columns: auto 1fr auto;
  align-items: center;
  gap: var(--space-2);
  margin-bottom: var(--space-2);
`

const chooserSectionCss = css`
  display: grid;
  gap: var(--space-2);
  min-width: 0;
`

const chooserSectionHeaderCss = css`
  display: flex;
  align-items: center;
  justify-content: flex-start;
  gap: var(--space-1);
`

const chooserPagerCss = css`
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
`

const chooserSectionLabelCss = css`
  color: var(--color-gray-400);
  font-size: 0.625rem;
  font-weight: 500;
  letter-spacing: 0.02em;
  line-height: 1.25;
`

const chooserGridCss = css`
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: var(--space-3);
`

const chooserGridOptionCss = css`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 40px;
  padding: 0 var(--space-2);
  border: 0;
  border-radius: var(--control-radius);
  background: var(--picker-accent-hover);
  color: var(--field-fg);
  cursor: pointer;
  font: inherit;
  font-size: 0.875rem;
  line-height: 1.2;
  text-align: center;
  transition:
    background-color 0.18s ease,
    color 0.18s ease,
    box-shadow 0.18s ease;

  &:focus-visible {
    outline: none;
    box-shadow: 0 0 0 var(--focus-ring-width) var(--picker-focus-ring);
  }

  &:disabled {
    background: var(--field-disabled-bg);
    color: var(--field-disabled-fg);
    cursor: not-allowed;
  }

  &:hover:not(:disabled) {
    background: var(--picker-accent-soft);
    color: var(--color-green-900);
  }
`

const chooserGridOptionSelectedCss = css`
  background: var(--picker-accent-bg);
  color: var(--picker-accent-fg);
  font-weight: 600;
`

const timePanelCss = css`
  display: grid;
  min-width: 0;
  gap: var(--space-1);
  align-self: stretch;
  align-content: start;
  padding: 0 0 0 var(--space-3);
  border-left: 1px solid rgba(31, 105, 100, 0.12);
  background: transparent;
`

const timePanelHeadingCss = css`
  color: var(--color-gray-400);
  font-size: 0.625rem;
  font-weight: 500;
  line-height: 1.25;
  letter-spacing: 0.02em;
`

const timeInputCss = css`
  width: 100%;
  box-sizing: border-box;
  min-height: 32px;
  padding: 5px 8px;
  border: 0;
  border-radius: var(--control-radius);
  background: var(--picker-accent-hover);
  color: var(--field-fg);
  font: inherit;
  font-size: 0.875rem;
  font-variant-numeric: tabular-nums;
  line-height: 1.25;

  &::placeholder {
    color: var(--field-placeholder);
  }

  &:focus {
    outline: none;
    box-shadow: 0 0 0 var(--focus-ring-width) var(--picker-focus-ring);
  }

  &:disabled {
    background: var(--field-disabled-bg);
    color: var(--field-disabled-fg);
  }
`

const timeControlsRowCss = css`
  display: flex;
  flex-wrap: wrap;
  align-items: stretch;
  gap: var(--space-1);
`

const timeStepperGroupCss = css`
  display: inline-flex;
  align-items: center;
  gap: 2px;
  border-radius: var(--control-radius);
  background: var(--picker-accent-soft);
  padding: 2px;
`

const timeStepperBtnCss = css`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  padding: 0;
  border: 0;
  border-radius: calc(var(--control-radius) - 1px);
  background: transparent;
  color: var(--color-green-800);
  cursor: pointer;
  font: inherit;
  font-size: 1rem;
  line-height: 1;

  &:focus-visible {
    outline: none;
    box-shadow: 0 0 0 var(--focus-ring-width) var(--picker-focus-ring);
  }

  &:disabled {
    color: var(--field-disabled-fg);
    cursor: not-allowed;
  }

  &:hover:not(:disabled) {
    background: var(--picker-accent-hover);
  }
`

const timeStepperValueCss = css`
  min-width: 2.25rem;
  padding: 0 4px;
  text-align: center;
  font-size: 0.8125rem;
  font-variant-numeric: tabular-nums;
  font-weight: 600;
  color: var(--field-fg);
`

const timePeriodToggleCss = css`
  display: inline-flex;
  border-radius: var(--control-radius);
  background: var(--picker-accent-soft);
  padding: 2px;
  gap: 2px;
`

const timePeriodSegmentCss = css`
  min-width: 2.5rem;
  padding: 6px 8px;
  border: 0;
  border-radius: calc(var(--control-radius) - 1px);
  background: transparent;
  color: var(--field-description);
  cursor: pointer;
  font: inherit;
  font-size: 0.8125rem;
  font-weight: 500;

  &:focus-visible {
    outline: none;
    box-shadow: 0 0 0 var(--focus-ring-width) var(--picker-focus-ring);
  }

  &:disabled {
    cursor: not-allowed;
    opacity: 0.5;
  }
`

const timePeriodSegmentSelectedCss = css`
  background: var(--picker-accent-bg);
  color: var(--picker-accent-fg);
  font-weight: 600;
`

const timeShortcutsCss = css`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-1);
  margin-top: 2px;
`

const timeShortcutButtonCss = css`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 26px;
  padding: 4px 8px;
  border: 1px solid var(--color-green-200);
  border-radius: 999px;
  background: var(--picker-accent-hover);
  color: var(--color-green-800);
  cursor: pointer;
  font: inherit;
  font-size: 0.6875rem;
  font-weight: 500;
  line-height: 1.2;

  &:focus-visible {
    outline: none;
    box-shadow: 0 0 0 var(--focus-ring-width) var(--picker-focus-ring);
  }

  &:disabled {
    border-color: var(--field-disabled-border);
    background: var(--field-disabled-bg);
    color: var(--field-disabled-fg);
    cursor: not-allowed;
  }

  &:hover:not(:disabled) {
    background: var(--picker-accent-soft);
    border-color: var(--color-green-300);
    color: var(--color-green-900);
  }
`

// eslint-disable-next-line i18next/no-literal-string
const previousMonthLabel = "Previous month"
// eslint-disable-next-line i18next/no-literal-string
const nextMonthLabel = "Next month"
// eslint-disable-next-line i18next/no-literal-string
const previousYearsLabel = "Previous years"
// eslint-disable-next-line i18next/no-literal-string
const nextYearsLabel = "Next years"
// eslint-disable-next-line i18next/no-literal-string
const backToCalendarLabel = "Back to calendar"
// eslint-disable-next-line i18next/no-literal-string
const clearLabel = "Clear"
// eslint-disable-next-line i18next/no-literal-string
const todayLabel = "Today"
// eslint-disable-next-line i18next/no-literal-string
const nowLabel = "Now"
// eslint-disable-next-line i18next/no-literal-string
const tomorrowLabel = "Tomorrow"
// eslint-disable-next-line i18next/no-literal-string
const nextWeekLabel = "Next week"
// eslint-disable-next-line i18next/no-literal-string
const timePanelLabel = "Time"
// eslint-disable-next-line i18next/no-literal-string
const plus30Label = "+30 min"
// eslint-disable-next-line i18next/no-literal-string
const endOfDayLabel = "End of day"
// eslint-disable-next-line i18next/no-literal-string
const chooseMonthYearLabel = "Choose month and year"
// eslint-disable-next-line i18next/no-literal-string
const pickMonthTitle = "Choose month"
// eslint-disable-next-line i18next/no-literal-string
const pickYearTitle = "Choose year"
// eslint-disable-next-line i18next/no-literal-string
const yearColumnLabel = "Year"
// eslint-disable-next-line i18next/no-literal-string
const leftDirection = "left" as const
// eslint-disable-next-line i18next/no-literal-string
const rightDirection = "right" as const
// eslint-disable-next-line i18next/no-literal-string
const dayPeriodAm = "am" as const
// eslint-disable-next-line i18next/no-literal-string
const dayPeriodPm = "pm" as const
// eslint-disable-next-line i18next/no-literal-string
const hourCycleH12 = "h12" as const
// eslint-disable-next-line i18next/no-literal-string
const hourCycleH23 = "h23" as const
// eslint-disable-next-line i18next/no-literal-string
const numericDateTimePart = "numeric" as const
// eslint-disable-next-line i18next/no-literal-string
const minuteTwoDigitPart = "2-digit" as const
// eslint-disable-next-line i18next/no-literal-string
const longDateTimePart = "long" as const
// eslint-disable-next-line i18next/no-literal-string
const decreaseHourAriaLabel = "Decrease hour"
// eslint-disable-next-line i18next/no-literal-string
const increaseHourAriaLabel = "Increase hour"
// eslint-disable-next-line i18next/no-literal-string
const decreaseMinuteAriaLabel = "Decrease minute"
// eslint-disable-next-line i18next/no-literal-string
const increaseMinuteAriaLabel = "Increase minute"
// eslint-disable-next-line i18next/no-literal-string
const dayPeriodGroupAriaLabel = "Day period"
// eslint-disable-next-line i18next/no-literal-string
const stepperMinusGlyph = "−"
const stepperPlusGlyph = "+"
// eslint-disable-next-line i18next/no-literal-string
const yearIdPrefix = "year-"
// eslint-disable-next-line i18next/no-literal-string
const monthIdPrefix = "month-"
// eslint-disable-next-line i18next/no-literal-string
const periodAmId = "period-am"
// eslint-disable-next-line i18next/no-literal-string
const periodPmId = "period-pm"
// eslint-disable-next-line i18next/no-literal-string
const pickerViewCalendar = "calendar" as const
// eslint-disable-next-line i18next/no-literal-string
const pickerViewMonth = "month" as const
// eslint-disable-next-line i18next/no-literal-string
const pickerViewYear = "year" as const

type SupportedHourCycle = "h11" | "h12" | "h23" | "h24"
type DayPeriod = typeof dayPeriodAm | typeof dayPeriodPm
type CalendarPickerView = typeof pickerViewCalendar | typeof pickerViewMonth | typeof pickerViewYear

type DatePickerTimeSelectorProps = {
  granularity: "hour" | "minute"
  hourCycle?: 12 | 24
  isDisabled?: boolean
  isReadOnly?: boolean
  minuteStep: number
  value: TimeValue | null
  onChange: (value: TimeValue) => void
}

type ChooserGridOption = {
  id: string
  isSelected: boolean
  label: string
  onSelect: () => void
}

function ChevronIcon({ direction }: { direction: "left" | "right" }) {
  return (
    <svg
      aria-hidden="true"
      className={calendarNavIconCss}
      fill="none"
      viewBox="0 0 12 12"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d={direction === "left" ? "M7.5 2.25L3.75 6l3.75 3.75" : "M4.5 2.25L8.25 6 4.5 9.75"}
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.5"
      />
    </svg>
  )
}

function CalendarNavButton({
  direction,
  isDisabled,
  label,
  onPress,
}: {
  direction: "left" | "right"
  isDisabled: boolean
  label: string
  onPress: () => void
}) {
  const ref = React.useRef<HTMLButtonElement>(null)
  const { buttonProps } = useButton(
    {
      "aria-label": label,
      isDisabled,
      onPress,
    },
    ref,
  )

  return (
    <button {...buttonProps} ref={ref} className={calendarNavButtonCss} type="button">
      <ChevronIcon direction={direction} />
    </button>
  )
}

function CalendarCell({
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

function CalendarGrid({
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

function resolveHourCycle(locale: string, hourCycle?: 12 | 24): SupportedHourCycle {
  const formatter = new Intl.DateTimeFormat(locale, {
    hour: numericDateTimePart,
    ...(hourCycle ? { hour12: hourCycle === 12 } : undefined),
  })
  const resolvedOptions = formatter.resolvedOptions() as Intl.ResolvedDateTimeFormatOptions & {
    hourCycle?: string
  }
  const resolvedHourCycle = resolvedOptions.hourCycle

  if (
    resolvedHourCycle === "h11" ||
    resolvedHourCycle === "h12" ||
    resolvedHourCycle === "h23" ||
    resolvedHourCycle === "h24"
  ) {
    return resolvedHourCycle
  }

  return hourCycle === 12 ? hourCycleH12 : hourCycleH23
}

function resolveDayPeriodLabels(locale: string) {
  const formatter = new Intl.DateTimeFormat(locale, {
    hour: numericDateTimePart,
    hour12: true,
    timeZone: "UTC",
  })

  const resolveLabel = (hour: number, fallback: string) => {
    const parts = formatter.formatToParts(new Date(Date.UTC(2024, 0, 1, hour)))
    return parts.find((part) => part.type === "dayPeriod")?.value ?? fallback
  }

  return {
    am: resolveLabel(9, "AM"),
    pm: resolveLabel(21, "PM"),
  }
}

function getSelectedDayPeriod(value: TimeValue | null) {
  if (!value) {
    return null
  }

  return value.hour >= 12 ? dayPeriodPm : dayPeriodAm
}

function getDisplayHour(hour: number, hourCycle: SupportedHourCycle) {
  switch (hourCycle) {
    case "h11":
      return hour % 12
    case "h12":
      return hour % 12 === 0 ? 12 : hour % 12
    case "h24":
      return hour === 0 ? 24 : hour
    case "h23":
    default:
      return hour
  }
}

function getBaseTime(value: TimeValue | null) {
  if (!value) {
    return new Time(0, 0)
  }

  return new Time(
    value.hour,
    value.minute,
    value.second,
    "millisecond" in value ? value.millisecond : 0,
  )
}

function withDayPeriod(hour: number, dayPeriod: DayPeriod) {
  const normalizedHour = hour % 12
  return dayPeriod === dayPeriodPm ? normalizedHour + 12 : normalizedHour
}

function formatTimeOption(value: number) {
  return String(value).padStart(2, "0")
}

function getYearPageStart(year: number) {
  return Math.floor((year - 1) / 12) * 12 + 1
}

/** Parses typed time strings (ISO or common h:mm with optional am/pm). */
function parseTimeInputFromUser(raw: string, hour12: boolean): Time | null {
  const trimmed = raw.trim()
  if (!trimmed) {
    return null
  }

  const match = trimmed.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?/)
  if (match) {
    let hour = Number(match[1])
    const minute = Number(match[2])
    const second = match[3] ? Number(match[3]) : 0
    if (hour12) {
      const upper = trimmed.toUpperCase()
      const isPm = upper.includes("PM")
      const isAm = upper.includes("AM")
      if (isPm && hour < 12) {
        hour += 12
      }
      if (isAm && hour === 12) {
        hour = 0
      }
    }
    return new Time(hour, minute, second)
  }

  try {
    return parseTime(trimmed.includes("T") ? trimmed : `T${trimmed}`)
  } catch {
    return null
  }
}

function adjustWallClockMinutes(value: Time, deltaMinutes: number): Time {
  let total = value.hour * 60 + value.minute + deltaMinutes
  total = ((total % 1440) + 1440) % 1440
  return new Time(Math.floor(total / 60), total % 60, value.second, value.millisecond)
}

/** Renders editable time, steppers, and AM/PM aligned with calendar accent styles. */
function HybridTimeSelector({
  timeSelectorProps,
}: {
  timeSelectorProps: DatePickerTimeSelectorProps
}) {
  const { locale } = useLocale()
  const groupId = useId()
  const inputId = useId()
  const hourCycle = resolveHourCycle(locale, timeSelectorProps.hourCycle)
  const showsDayPeriod = hourCycle === "h11" || hourCycle === "h12"
  const dayPeriodLabels = resolveDayPeriodLabels(locale)
  const baseTime = getBaseTime(timeSelectorProps.value)
  const isDisabled = Boolean(timeSelectorProps.isDisabled || timeSelectorProps.isReadOnly)

  const formattedDisplay = React.useMemo(() => {
    const refDate = new Date(2000, 0, 1, baseTime.hour, baseTime.minute, baseTime.second)
    return new Intl.DateTimeFormat(locale, {
      hour: numericDateTimePart,
      minute: minuteTwoDigitPart,
      hour12: showsDayPeriod,
    }).format(refDate)
  }, [baseTime.hour, baseTime.minute, baseTime.second, locale, showsDayPeriod])

  const [draft, setDraft] = React.useState(formattedDisplay)

  React.useEffect(() => {
    setDraft(formattedDisplay)
  }, [formattedDisplay])

  const selectedDayPeriod = getSelectedDayPeriod(timeSelectorProps.value)
  const displayHourLabel = formatTimeOption(getDisplayHour(baseTime.hour, hourCycle))
  const displayMinuteLabel = formatTimeOption(baseTime.minute)

  const applyTime = (next: Time) => {
    timeSelectorProps.onChange(next)
  }

  const onInputBlur = () => {
    if (timeSelectorProps.granularity === "hour") {
      setDraft(formattedDisplay)
      return
    }

    const parsed = parseTimeInputFromUser(draft, showsDayPeriod)
    if (parsed) {
      applyTime(parsed)
    } else {
      setDraft(formattedDisplay)
    }
  }

  return (
    <div className={timePanelCss} role="group" aria-labelledby={groupId}>
      <span id={groupId} className={timePanelHeadingCss}>
        {timePanelLabel}
      </span>
      <input
        aria-labelledby={groupId}
        className={timeInputCss}
        disabled={isDisabled}
        id={inputId}
        inputMode="numeric"
        type="text"
        value={draft}
        onBlur={onInputBlur}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.currentTarget.blur()
          }
        }}
      />
      <div className={timeControlsRowCss}>
        <div className={timeStepperGroupCss}>
          <button
            aria-label={decreaseHourAriaLabel}
            className={timeStepperBtnCss}
            disabled={isDisabled}
            type="button"
            onClick={() => {
              applyTime(adjustWallClockMinutes(baseTime, -60))
            }}
          >
            {stepperMinusGlyph}
          </button>
          <span className={timeStepperValueCss}>{displayHourLabel}</span>
          <button
            aria-label={increaseHourAriaLabel}
            className={timeStepperBtnCss}
            disabled={isDisabled}
            type="button"
            onClick={() => {
              applyTime(adjustWallClockMinutes(baseTime, 60))
            }}
          >
            {stepperPlusGlyph}
          </button>
        </div>
        {timeSelectorProps.granularity === "minute" ? (
          <div className={timeStepperGroupCss}>
            <button
              aria-label={decreaseMinuteAriaLabel}
              className={timeStepperBtnCss}
              disabled={isDisabled}
              type="button"
              onClick={() => {
                applyTime(adjustWallClockMinutes(baseTime, -timeSelectorProps.minuteStep))
              }}
            >
              {stepperMinusGlyph}
            </button>
            <span className={timeStepperValueCss}>{displayMinuteLabel}</span>
            <button
              aria-label={increaseMinuteAriaLabel}
              className={timeStepperBtnCss}
              disabled={isDisabled}
              type="button"
              onClick={() => {
                applyTime(adjustWallClockMinutes(baseTime, timeSelectorProps.minuteStep))
              }}
            >
              {stepperPlusGlyph}
            </button>
          </div>
        ) : null}
        {showsDayPeriod ? (
          <div aria-label={dayPeriodGroupAriaLabel} className={timePeriodToggleCss} role="group">
            <button
              className={cx(
                timePeriodSegmentCss,
                selectedDayPeriod === dayPeriodAm ? timePeriodSegmentSelectedCss : undefined,
              )}
              disabled={isDisabled}
              id={periodAmId}
              type="button"
              onClick={() => {
                applyTime(baseTime.set({ hour: withDayPeriod(baseTime.hour, dayPeriodAm) }))
              }}
            >
              {dayPeriodLabels.am}
            </button>
            <button
              className={cx(
                timePeriodSegmentCss,
                selectedDayPeriod === dayPeriodPm ? timePeriodSegmentSelectedCss : undefined,
              )}
              disabled={isDisabled}
              id={periodPmId}
              type="button"
              onClick={() => {
                applyTime(baseTime.set({ hour: withDayPeriod(baseTime.hour, dayPeriodPm) }))
              }}
            >
              {dayPeriodLabels.pm}
            </button>
          </div>
        ) : null}
      </div>
      {timeSelectorProps.granularity === "minute" ? (
        <div className={timeShortcutsCss}>
          <button
            className={timeShortcutButtonCss}
            disabled={isDisabled}
            type="button"
            onClick={() => {
              applyTime(baseTime.add({ minutes: 30 }))
            }}
          >
            {plus30Label}
          </button>
          <button
            className={timeShortcutButtonCss}
            disabled={isDisabled}
            type="button"
            onClick={() => {
              applyTime(new Time(23, 59, 0))
            }}
          >
            {endOfDayLabel}
          </button>
        </div>
      ) : null}
    </div>
  )
}

function ChooserGridSection({
  isDisabled,
  label,
  options,
  pager,
}: {
  isDisabled: boolean
  label?: string
  options: ChooserGridOption[]
  pager?: React.ReactNode
}) {
  const labelId = useId()
  const selectedIndex = options.findIndex((option) => option.isSelected)
  const defaultIndex = selectedIndex >= 0 ? selectedIndex : 0

  return (
    <div className={chooserSectionCss}>
      {label || pager ? (
        <div className={chooserSectionHeaderCss}>
          {label ? (
            <span id={labelId} className={chooserSectionLabelCss}>
              {label}
            </span>
          ) : null}
          {pager}
        </div>
      ) : null}
      <div aria-labelledby={label ? labelId : undefined} className={chooserGridCss} role="group">
        {options.map((option, index) => (
          <button
            key={option.id}
            aria-pressed={option.isSelected}
            className={cx(
              chooserGridOptionCss,
              option.isSelected ? chooserGridOptionSelectedCss : undefined,
            )}
            data-selected={option.isSelected ? "true" : "false"}
            disabled={isDisabled}
            tabIndex={index === defaultIndex ? 0 : -1}
            type="button"
            onClick={option.onSelect}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  )
}

export type DatePickerCalendarProps = {
  calendarProps: CalendarProps<DateValue>
  canClear: boolean
  dialogProps: AriaDialogProps
  onClear: () => void
  onSelectNextWeek?: (value: ReturnType<typeof useCalendarState>["visibleRange"]["start"]) => void
  onSelectNow?: () => void
  onSelectToday: (value: ReturnType<typeof useCalendarState>["visibleRange"]["start"]) => void
  onSelectTomorrow?: (value: ReturnType<typeof useCalendarState>["visibleRange"]["start"]) => void
  timeSelectorProps?: DatePickerTimeSelectorProps
}

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
  const yearGridOptions: ChooserGridOption[] = chooserYears.map((year) => ({
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
  const monthGridOptions: ChooserGridOption[] = monthOptions.map((option) => ({
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
