"use client"

import {
  createCalendar,
  getLocalTimeZone,
  GregorianCalendar,
  now,
  toCalendar,
  toCalendarDate,
  toTime,
} from "@internationalized/date"
import { useDateFieldState, useDatePickerState } from "@react-stately/datepicker"
import type { DateValue } from "react-aria"
import { useDateField, useDatePicker } from "react-aria"

import { omitUndefined } from "../../../lib/utils/nullability"
import { PickerSegmentedField } from "./PickerSegmentedField"
import type { dayGranularity } from "./segmentedDateInputFieldConstants"
import { minuteGranularity } from "./segmentedDateInputFieldConstants"
import { datePickerPopoverCss, dateTimePickerPopoverCss } from "./segmentedDateInputFieldStyles"
import {
  parseDateLikeValue,
  resolveMinuteStep,
  type SegmentedFieldBase,
  serializeDateLikeInputValue,
} from "./segmentedDateInputFieldUtils"

/** Date or datetime field using picker state, popover, and optional time selector. */
export function DateLikePickerInner({
  base,
  currentValue,
  granularity,
  kind,
  onClear,
  onCommitValue,
}: {
  base: SegmentedFieldBase
  currentValue: DateValue | null
  granularity: typeof dayGranularity | typeof minuteGranularity
  kind: "date" | "datetime"
  onClear: () => void
  onCommitValue: (value: DateValue | null) => void
}) {
  const parsedMinValue = parseDateLikeValue(kind, base.min)
  const parsedMaxValue = parseDateLikeValue(kind, base.max)

  const pickerProps = {
    id: base.id,
    label: base.label,
    description: base.description,
    errorMessage: base.errorMessage,
    granularity,
    value: currentValue,
    isDisabled: base.resolvedState.isDisabled,
    isReadOnly: base.resolvedState.isReadOnly,
    isRequired: base.resolvedState.isRequired,
    isInvalid: base.resolvedState.isInvalid,
    shouldCloseOnSelect: kind === "date",
    onChange: onCommitValue,
    ...omitUndefined({
      hourCycle: base.hourCycle,
      minValue: parsedMinValue,
      maxValue: parsedMaxValue,
    }),
  }

  const pickerState = useDatePickerState(pickerProps)
  const pickerAria = useDatePicker(pickerProps, pickerState, base.groupRef)
  const dateFieldProps = {
    ...pickerAria.fieldProps,
    createCalendar,
    locale: base.locale,
  }
  const state = useDateFieldState(dateFieldProps)
  const dateFieldAria = useDateField(dateFieldProps, state, base.fieldRef)
  const canClear =
    currentValue !== null || pickerState.dateValue !== null || pickerState.timeValue !== null

  return (
    <PickerSegmentedField
      canClear={canClear}
      className={base.className}
      dateFieldAria={dateFieldAria}
      description={base.description}
      errorMessage={base.errorMessage}
      fieldRef={base.fieldRef}
      fieldSize={base.fieldSize}
      groupRef={base.groupRef}
      hiddenInputRef={base.hiddenInputRef}
      hiddenInputValue={serializeDateLikeInputValue(kind, state.value, minuteGranularity)}
      inputRef={base.inputRef}
      iconEnd={base.iconEnd}
      iconStart={base.iconStart}
      isFocused={base.isFocused}
      label={base.label}
      layout={base.layout}
      notice={base.notice}
      noticeId={base.noticeId}
      externalOnBlur={base.externalOnBlur}
      externalOnFocus={base.externalOnFocus}
      onClear={() => {
        pickerState.setOpen(false)
        onClear()
      }}
      onSelectNextWeek={(value) => {
        if (kind === "date") {
          pickerState.setValue(value)
          pickerState.setOpen(false)
          return
        }

        pickerState.setDateValue(value)
      }}
      onSelectNow={
        kind === "datetime"
          ? () => {
              const zdt = now(getLocalTimeZone())
              const calendar = currentValue?.calendar ?? new GregorianCalendar()
              const date = toCalendar(toCalendarDate(zdt), calendar)
              const time = toTime(zdt)
              pickerState.setDateValue(date)
              pickerState.setTimeValue(time)
            }
          : undefined
      }
      onSelectToday={(value) => {
        if (kind === "date") {
          pickerState.setValue(value)
          pickerState.setOpen(false)
          return
        }

        pickerState.setDateValue(value)
      }}
      onSelectTomorrow={(value) => {
        if (kind === "date") {
          pickerState.setValue(value)
          pickerState.setOpen(false)
          return
        }

        pickerState.setDateValue(value)
      }}
      pickerAria={pickerAria}
      pickerState={pickerState}
      popoverClassName={kind === "date" ? datePickerPopoverCss : dateTimePickerPopoverCss}
      resolvedState={base.resolvedState}
      setIsFocused={base.setIsFocused}
      state={state}
      timeSelectorProps={
        kind === "datetime"
          ? {
              granularity: minuteGranularity,
              isDisabled: base.resolvedState.isDisabled,
              isReadOnly: base.resolvedState.isReadOnly,
              minuteStep: resolveMinuteStep(base.step),
              value: pickerState.timeValue,
              onChange: (nextValue) => {
                pickerState.setTimeValue(nextValue)
              },
              ...omitUndefined({ hourCycle: base.hourCycle }),
            }
          : undefined
      }
    />
  )
}
