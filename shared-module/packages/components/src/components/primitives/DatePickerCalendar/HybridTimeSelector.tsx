"use client"

import { cx } from "@emotion/css"
import { Time } from "@internationalized/date"
import React, { useId } from "react"
import { useLocale } from "react-aria"

import {
  dayPeriodAm,
  dayPeriodGroupAriaLabel,
  dayPeriodPm,
  decreaseHourAriaLabel,
  decreaseMinuteAriaLabel,
  endOfDayLabel,
  increaseHourAriaLabel,
  increaseMinuteAriaLabel,
  minuteTwoDigitPart,
  numericDateTimePart,
  periodAmId,
  periodPmId,
  plus30Label,
  stepperMinusGlyph,
  stepperPlusGlyph,
  timePanelLabel,
} from "./datePickerCalendarConstants"
import {
  timeControlsRowCss,
  timeInputCss,
  timePanelCss,
  timePanelHeadingCss,
  timePeriodSegmentCss,
  timePeriodSegmentSelectedCss,
  timePeriodToggleCss,
  timeShortcutButtonCss,
  timeShortcutsCss,
  timeStepperBtnCss,
  timeStepperGroupCss,
  timeStepperValueCss,
} from "./datePickerCalendarStyles"
import {
  adjustWallClockMinutes,
  formatTimeOption,
  getBaseTime,
  getDisplayHour,
  getSelectedDayPeriod,
  parseTimeInputFromUser,
  resolveDayPeriodLabels,
  resolveHourCycle,
  withDayPeriod,
} from "./datePickerCalendarTimeUtils"
import type { DatePickerTimeSelectorProps } from "./datePickerCalendarTypes"

/** Renders editable time controls alongside the calendar when datetime mode is used. */
export function HybridTimeSelector({
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
