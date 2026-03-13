"use client"

import { css, cx } from "@emotion/css"
import {
  createCalendar,
  isSameMonth,
  isToday,
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

const pickerLayoutCss = css`
  display: grid;
  width: 100%;
  box-sizing: border-box;
  gap: var(--space-4);
  padding: var(--space-4);
`

const pickerLayoutWithTimeCss = css`
  grid-template-columns: repeat(auto-fit, minmax(248px, 1fr));
  align-items: start;
`

const calendarPanelCss = css`
  display: grid;
  gap: var(--space-3);
  min-width: 0;
`

const calendarHeaderCss = css`
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: var(--space-2);
`

const calendarHeaderCenterCss = css`
  min-width: 0;
`

const monthYearButtonCss = css`
  width: 100%;
  min-height: 38px;
  display: inline-flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  padding: 0 14px 0 var(--space-3);
  border: 1px solid var(--field-border);
  border-radius: calc(var(--control-radius) + 2px);
  background: var(--field-bg);
  color: var(--field-fg);
  cursor: pointer;
  font: inherit;
  font-weight: 600;
  text-align: left;

  &:focus-visible {
    outline: none;
    border-color: var(--field-border-focus);
    box-shadow: 0 0 0 var(--focus-ring-width) rgba(8, 69, 122, 0.14);
  }

  &:disabled {
    background: var(--field-disabled-bg);
    color: var(--field-disabled-fg);
    border-color: var(--field-disabled-border);
    cursor: not-allowed;
  }
`

const calendarNavButtonCss = css`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
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
    background: var(--color-blue-50);
    color: var(--color-blue-700);
    box-shadow: 0 0 0 var(--focus-ring-width) rgba(8, 69, 122, 0.14);
  }

  &:disabled {
    color: var(--field-disabled-fg);
    cursor: not-allowed;
  }

  &:hover:not(:disabled) {
    background: var(--color-blue-50);
    color: var(--color-blue-700);
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
  padding: 0 0 var(--space-2);
  color: var(--field-description);
  font-size: 0.75rem;
  font-weight: 600;
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
  width: 38px;
  height: 38px;
  padding: 0;
  border: 0;
  border-radius: 999px;
  background: transparent;
  color: var(--field-fg);
  cursor: pointer;
  font: inherit;
  line-height: 1;
  transition:
    background-color 0.18s ease,
    color 0.18s ease,
    box-shadow 0.18s ease;

  &:focus-visible {
    outline: none;
    box-shadow: 0 0 0 var(--focus-ring-width) rgba(8, 69, 122, 0.14);
  }

  &:disabled {
    cursor: not-allowed;
  }

  &:hover:not(:disabled) {
    background: var(--field-option-highlight);
  }
`

const calendarCellTodayCss = css`
  box-shadow: inset 0 0 0 1px var(--color-blue-400);
`

const calendarCellSelectedCss = css`
  background: var(--color-green-600);
  color: var(--color-primary-100);
`

const calendarCellFocusedCss = css`
  box-shadow: 0 0 0 var(--focus-ring-width) rgba(8, 69, 122, 0.22);
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
  gap: var(--space-2);
  padding-top: var(--space-2);
  border-top: 1px solid var(--field-border);
`

const quickActionButtonCss = css`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 34px;
  padding: 0 var(--space-3);
  border: 1px solid var(--field-border);
  border-radius: 999px;
  background: var(--field-bg);
  color: var(--field-fg);
  cursor: pointer;
  font: inherit;
  font-size: 0.875rem;
  font-weight: 500;
  transition:
    border-color 0.18s ease,
    background-color 0.18s ease,
    color 0.18s ease,
    box-shadow 0.18s ease;

  &:focus-visible {
    outline: none;
    box-shadow: 0 0 0 var(--focus-ring-width) rgba(8, 69, 122, 0.14);
  }

  &:disabled {
    background: var(--field-disabled-bg);
    color: var(--field-disabled-fg);
    border-color: var(--field-disabled-border);
    cursor: not-allowed;
  }

  &:hover:not(:disabled) {
    background: var(--field-option-highlight);
    border-color: var(--field-border-focus);
  }
`

const chooserPanelCss = css`
  display: grid;
  gap: var(--space-3);
  min-width: 0;
  width: 100%;
`

const chooserHeaderCss = css`
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  align-items: center;
  gap: var(--space-2);
`

const chooserTitleCss = css`
  color: var(--field-label);
  font-size: 0.9375rem;
  font-weight: 700;
  line-height: 1.2;
  text-align: center;
`

const chooserColumnsCss = css`
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--space-3);
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
  color: var(--field-description);
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.03em;
  line-height: 1.2;
  text-transform: uppercase;
`

const chooserGridCss = css`
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: var(--space-2);
`

const chooserGridOptionCss = css`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 42px;
  padding: 0 var(--space-2);
  border: 1px solid var(--field-border);
  border-radius: calc(var(--control-radius) + 2px);
  background: var(--field-bg);
  color: var(--field-fg);
  cursor: pointer;
  font: inherit;
  font-size: 0.9375rem;
  line-height: 1.2;
  text-align: center;
  transition:
    border-color 0.18s ease,
    background-color 0.18s ease,
    color 0.18s ease,
    box-shadow 0.18s ease;

  &:focus-visible {
    outline: none;
    box-shadow: 0 0 0 var(--focus-ring-width) rgba(8, 69, 122, 0.14);
  }

  &:disabled {
    background: var(--field-disabled-bg);
    color: var(--field-disabled-fg);
    border-color: var(--field-disabled-border);
    cursor: not-allowed;
  }

  &:hover:not(:disabled) {
    background: var(--field-option-highlight);
    border-color: var(--field-border-focus);
  }
`

const chooserGridOptionSelectedCss = css`
  background: var(--color-blue-50);
  color: var(--color-blue-700);
  border-color: var(--color-blue-300);
  font-weight: 700;
`

const timePanelCss = css`
  display: grid;
  min-width: 0;
  gap: var(--space-3);
  align-self: stretch;
  padding: var(--space-3);
  border: 1px solid var(--field-border);
  border-radius: calc(var(--control-radius) + 6px);
  background: linear-gradient(180deg, rgba(8, 69, 122, 0.04), rgba(8, 69, 122, 0));
`

const timePanelHeadingCss = css`
  color: var(--field-label);
  font-size: 0.8125rem;
  font-weight: 700;
  line-height: 1.2;
  letter-spacing: 0.02em;
  text-transform: uppercase;
`

const timeColumnsCss = css`
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--space-3);

  &[data-has-day-period="true"] {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
`

const timeColumnCss = css`
  display: grid;
  gap: var(--space-2);
  min-width: 0;
`

const timeColumnLabelCss = css`
  color: var(--field-description);
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.03em;
  line-height: 1.2;
  text-transform: uppercase;
`

const timeColumnListCss = css`
  display: grid;
  gap: var(--space-1);
  max-height: 236px;
  padding-right: 4px;
  overflow-y: auto;
`

const timeColumnOptionCss = css`
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 36px;
  padding: 0 var(--space-2);
  border: 0;
  border-radius: calc(var(--control-radius) + 1px);
  background: transparent;
  color: var(--field-fg);
  cursor: pointer;
  font: inherit;
  font-size: 0.9375rem;
  line-height: 1;
  transition:
    background-color 0.18s ease,
    color 0.18s ease,
    box-shadow 0.18s ease;

  &:focus-visible {
    outline: none;
    box-shadow: 0 0 0 var(--focus-ring-width) rgba(8, 69, 122, 0.14);
  }

  &:disabled {
    color: var(--field-disabled-fg);
    cursor: not-allowed;
  }

  &:hover:not(:disabled) {
    background: var(--field-option-highlight);
  }
`

const timeColumnOptionSelectedCss = css`
  background: var(--color-blue-50);
  color: var(--color-blue-700);
  font-weight: 700;
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
const timePanelLabel = "Time"
// eslint-disable-next-line i18next/no-literal-string
const hourLabel = "Hour"
// eslint-disable-next-line i18next/no-literal-string
const minuteLabel = "Minutes"
// eslint-disable-next-line i18next/no-literal-string
const dayPeriodLabel = "AM / PM"
// eslint-disable-next-line i18next/no-literal-string
const chooseMonthYearLabel = "Choose month and year"
// eslint-disable-next-line i18next/no-literal-string
const chooseMonthYearTitle = "Select month and year"
// eslint-disable-next-line i18next/no-literal-string
const yearColumnLabel = "Year"
// eslint-disable-next-line i18next/no-literal-string
const monthColumnLabel = "Month"
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
const longDateTimePart = "long" as const
// eslint-disable-next-line i18next/no-literal-string
const nearestScrollBlock = "nearest" as const
// eslint-disable-next-line i18next/no-literal-string
const hourIdPrefix = "hour-"
// eslint-disable-next-line i18next/no-literal-string
const minuteIdPrefix = "minute-"
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
const pickerViewChooser = "chooser" as const

type SupportedHourCycle = "h11" | "h12" | "h23" | "h24"
type DayPeriod = typeof dayPeriodAm | typeof dayPeriodPm
type CalendarPickerView = typeof pickerViewCalendar | typeof pickerViewChooser

type DatePickerTimeSelectorProps = {
  granularity: "hour" | "minute"
  hourCycle?: 12 | 24
  isDisabled?: boolean
  isReadOnly?: boolean
  minuteStep: number
  value: TimeValue | null
  onChange: (value: TimeValue) => void
}

type TimeColumnOption = {
  id: string
  isSelected: boolean
  label: string
  onSelect: () => void
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

  return (
    <td {...cellProps} className={calendarCellCss}>
      <button
        {...buttonProps}
        ref={ref}
        className={cx(
          calendarCellButtonCss,
          isToday(date, state.timeZone) ? calendarCellTodayCss : undefined,
          isSelected ? calendarCellSelectedCss : undefined,
          isFocused ? calendarCellFocusedCss : undefined,
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

function getHourOptions(hourCycle: SupportedHourCycle) {
  switch (hourCycle) {
    case "h11":
      return Array.from({ length: 12 }, (_, index) => index)
    case "h12":
      return [12, ...Array.from({ length: 11 }, (_, index) => index + 1)]
    case "h24":
      return [...Array.from({ length: 23 }, (_, index) => index + 1), 24]
    case "h23":
    default:
      return Array.from({ length: 24 }, (_, index) => index)
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

function toInternalHour(displayHour: number, hourCycle: SupportedHourCycle, currentHour: number) {
  switch (hourCycle) {
    case "h11":
      return currentHour >= 12 ? displayHour + 12 : displayHour
    case "h12": {
      const normalizedHour = displayHour % 12
      return currentHour >= 12 ? normalizedHour + 12 : normalizedHour
    }
    case "h24":
      return displayHour === 24 ? 0 : displayHour
    case "h23":
    default:
      return displayHour
  }
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

function TimeColumn({
  isDisabled,
  label,
  options,
}: {
  isDisabled: boolean
  label: string
  options: TimeColumnOption[]
}) {
  const labelId = useId()
  const listRef = React.useRef<HTMLDivElement>(null)
  const selectedIndex = options.findIndex((option) => option.isSelected)
  const defaultIndex = selectedIndex >= 0 ? selectedIndex : 0

  React.useEffect(() => {
    const selectedOption = listRef.current?.querySelector<HTMLElement>('[data-selected="true"]')
    selectedOption?.scrollIntoView?.({ block: nearestScrollBlock })
  }, [selectedIndex])

  const focusOption = (index: number) => {
    listRef.current?.querySelector<HTMLButtonElement>(`[data-option-index="${index}"]`)?.focus()
  }

  return (
    <div className={timeColumnCss}>
      <span id={labelId} className={timeColumnLabelCss}>
        {label}
      </span>
      <div ref={listRef} role="radiogroup" aria-labelledby={labelId} className={timeColumnListCss}>
        {options.map((option, index) => (
          <button
            key={option.id}
            aria-checked={option.isSelected}
            className={cx(
              timeColumnOptionCss,
              option.isSelected ? timeColumnOptionSelectedCss : undefined,
            )}
            data-option-index={index}
            data-selected={option.isSelected ? "true" : "false"}
            disabled={isDisabled}
            role="radio"
            tabIndex={index === defaultIndex ? 0 : -1}
            type="button"
            onClick={option.onSelect}
            onKeyDown={(event) => {
              if (isDisabled) {
                return
              }

              let nextIndex = index

              switch (event.key) {
                case "ArrowDown":
                case "ArrowRight":
                  nextIndex = (index + 1) % options.length
                  break
                case "ArrowUp":
                case "ArrowLeft":
                  nextIndex = (index - 1 + options.length) % options.length
                  break
                case "Home":
                  nextIndex = 0
                  break
                case "End":
                  nextIndex = options.length - 1
                  break
                default:
                  return
              }

              event.preventDefault()
              options[nextIndex]?.onSelect()
              focusOption(nextIndex)
            }}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  )
}

function TimeSelector({ timeSelectorProps }: { timeSelectorProps: DatePickerTimeSelectorProps }) {
  const { locale } = useLocale()
  const groupId = useId()
  const hourCycle = resolveHourCycle(locale, timeSelectorProps.hourCycle)
  const showsDayPeriod = hourCycle === "h11" || hourCycle === "h12"
  const dayPeriodLabels = resolveDayPeriodLabels(locale)
  const selectedDayPeriod = getSelectedDayPeriod(timeSelectorProps.value)
  const selectedHour = timeSelectorProps.value
    ? getDisplayHour(timeSelectorProps.value.hour, hourCycle)
    : null
  const baseTime = getBaseTime(timeSelectorProps.value)
  const isDisabled = Boolean(timeSelectorProps.isDisabled || timeSelectorProps.isReadOnly)

  const hourOptions = getHourOptions(hourCycle).map((displayHour) => ({
    id: `${hourIdPrefix}${displayHour}`,
    isSelected: selectedHour === displayHour,
    label: formatTimeOption(displayHour),
    onSelect: () => {
      timeSelectorProps.onChange(
        baseTime.set({
          hour: toInternalHour(displayHour, hourCycle, baseTime.hour),
        }),
      )
    },
  }))

  const minuteOptions = Array.from(
    { length: Math.ceil(60 / timeSelectorProps.minuteStep) },
    (_, index) => index * timeSelectorProps.minuteStep,
  )
    .filter((minute) => minute < 60)
    .map((minute) => ({
      id: `${minuteIdPrefix}${minute}`,
      isSelected: timeSelectorProps.value?.minute === minute,
      label: formatTimeOption(minute),
      onSelect: () => {
        timeSelectorProps.onChange(
          baseTime.set({
            minute,
          }),
        )
      },
    }))

  const dayPeriodOptions = showsDayPeriod
    ? [
        {
          id: periodAmId,
          isSelected: selectedDayPeriod === dayPeriodAm,
          label: dayPeriodLabels.am,
          onSelect: () => {
            timeSelectorProps.onChange(
              baseTime.set({
                hour: withDayPeriod(baseTime.hour, dayPeriodAm),
              }),
            )
          },
        },
        {
          id: periodPmId,
          isSelected: selectedDayPeriod === dayPeriodPm,
          label: dayPeriodLabels.pm,
          onSelect: () => {
            timeSelectorProps.onChange(
              baseTime.set({
                hour: withDayPeriod(baseTime.hour, dayPeriodPm),
              }),
            )
          },
        },
      ]
    : []

  return (
    <div className={timePanelCss} role="group" aria-labelledby={groupId}>
      <span id={groupId} className={timePanelHeadingCss}>
        {timePanelLabel}
      </span>
      <div className={timeColumnsCss} data-has-day-period={showsDayPeriod ? "true" : "false"}>
        <TimeColumn isDisabled={isDisabled} label={hourLabel} options={hourOptions} />
        {timeSelectorProps.granularity === "minute" ? (
          <TimeColumn isDisabled={isDisabled} label={minuteLabel} options={minuteOptions} />
        ) : null}
        {showsDayPeriod ? (
          <TimeColumn isDisabled={isDisabled} label={dayPeriodLabel} options={dayPeriodOptions} />
        ) : null}
      </div>
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
  label: string
  options: ChooserGridOption[]
  pager?: React.ReactNode
}) {
  const labelId = useId()
  const selectedIndex = options.findIndex((option) => option.isSelected)
  const defaultIndex = selectedIndex >= 0 ? selectedIndex : 0

  return (
    <div className={chooserSectionCss}>
      <div className={chooserSectionHeaderCss}>
        <span id={labelId} className={chooserSectionLabelCss}>
          {label}
        </span>
        {pager}
      </div>
      <div aria-labelledby={labelId} className={chooserGridCss} role="group">
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

function MonthYearChooser({
  isInteractive,
  monthOptions,
  selectedMonth,
  selectedYear,
  yearPageStart,
  onBackToCalendar,
  onChooseMonth,
  onChooseYear,
  onNextYearPage,
  onPreviousYearPage,
}: {
  isInteractive: boolean
  monthOptions: Array<{ label: string; value: number }>
  selectedMonth: number
  selectedYear: number
  yearPageStart: number
  onBackToCalendar: () => void
  onChooseMonth: (month: number) => void
  onChooseYear: (year: number) => void
  onNextYearPage: () => void
  onPreviousYearPage: () => void
}) {
  const chooserYears = Array.from({ length: 12 }, (_, index) => yearPageStart + index)
  const yearOptions: ChooserGridOption[] = chooserYears.map((year) => ({
    id: `${yearIdPrefix}${year}`,
    isSelected: year === selectedYear,
    label: String(year),
    onSelect: () => onChooseYear(year),
  }))
  const monthGridOptions: ChooserGridOption[] = monthOptions.map((option) => ({
    id: `${monthIdPrefix}${option.value}`,
    isSelected: option.value === selectedMonth,
    label: option.label,
    onSelect: () => onChooseMonth(option.value),
  }))

  return (
    <div className={chooserPanelCss}>
      <div className={chooserHeaderCss}>
        <button
          aria-label={backToCalendarLabel}
          className={calendarNavButtonCss}
          disabled={!isInteractive}
          type="button"
          onClick={onBackToCalendar}
        >
          <ChevronIcon direction={leftDirection} />
        </button>
        <div className={chooserTitleCss}>{chooseMonthYearTitle}</div>
      </div>

      <div className={chooserColumnsCss}>
        <ChooserGridSection
          isDisabled={!isInteractive}
          label={yearColumnLabel}
          options={yearOptions}
          pager={
            <div className={chooserPagerCss}>
              <CalendarNavButton
                direction={leftDirection}
                isDisabled={!isInteractive}
                label={previousYearsLabel}
                onPress={onPreviousYearPage}
              />
              <CalendarNavButton
                direction={rightDirection}
                isDisabled={!isInteractive}
                label={nextYearsLabel}
                onPress={onNextYearPage}
              />
            </div>
          }
        />

        <ChooserGridSection
          isDisabled={!isInteractive}
          label={monthColumnLabel}
          options={monthGridOptions}
        />
      </div>
    </div>
  )
}

export type DatePickerCalendarProps = {
  calendarProps: CalendarProps<DateValue>
  canClear: boolean
  dialogProps: AriaDialogProps
  onClear: () => void
  onSelectToday: (value: ReturnType<typeof useCalendarState>["visibleRange"]["start"]) => void
  timeSelectorProps?: DatePickerTimeSelectorProps
}

export function DatePickerCalendar({
  calendarProps,
  canClear,
  dialogProps,
  onClear,
  onSelectToday,
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
  const openMonthYearChooser = () => {
    setDraftYear(state.visibleRange.start.year)
    setYearPageStart(getYearPageStart(state.visibleRange.start.year))
    setPickerView(pickerViewChooser)
  }

  const applyMonthYearSelection = (year: number, month: number) => {
    const nextDate = state.focusedDate.set({
      day: 1,
      month,
      year,
    })
    state.setFocusedDate(nextDate)
    setDraftYear(year)
    setYearPageStart(getYearPageStart(year))
    setPickerView(pickerViewCalendar)
  }

  return (
    <div {...resolvedDialogProps} ref={ref} className={dialogCss}>
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
                    aria-label={`${chooseMonthYearLabel}: ${visibleMonthLabel} ${visibleYearLabel}`}
                    className={monthYearButtonCss}
                    disabled={!isInteractive}
                    type="button"
                    onClick={openMonthYearChooser}
                  >
                    <span>{`${visibleMonthLabel} ${visibleYearLabel}`}</span>
                    <ChevronIcon direction={rightDirection} />
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
                  className={quickActionButtonCss}
                  disabled={!canClear || !isInteractive}
                  type="button"
                  onClick={onClear}
                >
                  {clearLabel}
                </button>
                <button
                  className={quickActionButtonCss}
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
              </div>
            </div>

            {timeSelectorProps ? <TimeSelector timeSelectorProps={timeSelectorProps} /> : null}
          </>
        ) : (
          <MonthYearChooser
            isInteractive={isInteractive}
            monthOptions={monthOptions}
            selectedMonth={state.visibleRange.start.month}
            selectedYear={draftYear}
            yearPageStart={yearPageStart}
            onBackToCalendar={() => setPickerView(pickerViewCalendar)}
            onChooseMonth={(month) => applyMonthYearSelection(draftYear, month)}
            onChooseYear={(year) => setDraftYear(year)}
            onNextYearPage={() => setYearPageStart((current) => current + 12)}
            onPreviousYearPage={() => setYearPageStart((current) => Math.max(1, current - 12))}
          />
        )}
      </div>
    </div>
  )
}
