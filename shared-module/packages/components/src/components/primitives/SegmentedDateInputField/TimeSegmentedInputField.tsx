"use client"

import { useTimeFieldState } from "@react-stately/datepicker"
import React from "react"
import type { TimeValue } from "react-aria"
import { useTimeField } from "react-aria"

import { omitUndefined } from "../../../lib/utils/nullability"
import { NonPickerSegmentedField } from "./NonPickerSegmentedField"
import { minuteGranularity } from "./segmentedDateInputFieldConstants"
import {
  emitSyntheticChange,
  parseTimeOnlyValue,
  serializeTimeValue,
  useSegmentedFieldBase,
} from "./segmentedDateInputFieldUtils"
import type { TimeOnlyFieldProps } from "./segmentTypes"

/** Segmented control for `time` inputs (no calendar). */
export function TimeSegmentedInputField(
  props: TimeOnlyFieldProps,
  forwardedRef: React.ForwardedRef<HTMLDivElement>,
) {
  const base = useSegmentedFieldBase(props, forwardedRef)
  const granularity = minuteGranularity
  // react-aria's useTimeField enters an infinite render loop when the controlled `value` is a fresh
  // object identity on every render (useDateField, used by the date/datetime paths, tolerates it).
  // Memoize the parsed values so their identity stays stable while the underlying string is unchanged.
  const parsedValue = React.useMemo(() => parseTimeOnlyValue(base.value), [base.value])
  const parsedMinValue = React.useMemo(() => parseTimeOnlyValue(base.min), [base.min])
  const parsedMaxValue = React.useMemo(() => parseTimeOnlyValue(base.max), [base.max])

  const fieldProps = {
    id: base.id,
    inputRef: base.hiddenInputRef,
    label: base.label,
    description: base.description,
    errorMessage: base.errorMessage,
    locale: base.locale,
    granularity,
    value: parsedValue ?? null,
    isDisabled: base.resolvedState.isDisabled,
    isReadOnly: base.resolvedState.isReadOnly,
    isRequired: base.resolvedState.isRequired,
    isInvalid: base.resolvedState.isInvalid,
    ...omitUndefined({
      hourCycle: base.hourCycle,
      minValue: parsedMinValue,
      maxValue: parsedMaxValue,
    }),
    onChange: (nextValue: TimeValue | null) => {
      const serializedValue = serializeTimeValue(nextValue, granularity)
      base.onValueChange?.(serializedValue)
      emitSyntheticChange(base.hiddenInputRef.current, base.onChange, serializedValue)
    },
  }

  const state = useTimeFieldState(fieldProps)
  const aria = useTimeField(fieldProps, state, base.fieldRef)

  return (
    <NonPickerSegmentedField
      aria={aria}
      className={base.className}
      description={base.description}
      errorMessage={base.errorMessage}
      fieldRef={base.fieldRef}
      fieldSize={base.fieldSize}
      hiddenInputRef={base.hiddenInputRef}
      hiddenInputValue={serializeTimeValue(state.value as TimeValue | null, granularity)}
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
      resolvedState={base.resolvedState}
      setIsFocused={base.setIsFocused}
      state={state}
    />
  )
}
