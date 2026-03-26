"use client"

import React, { useEffect, useRef, useState } from "react"
import type { DateValue } from "react-aria"

import { DateLikePickerInner } from "./DateLikePickerInner"
import type { DateLikeFieldProps } from "./segmentTypes"
import { dayGranularity, minuteGranularity } from "./segmentedDateInputFieldConstants"
import {
  emitSyntheticChange,
  parseDateLikeValue,
  serializeDateLikeInputValue,
  useSegmentedFieldBase,
} from "./segmentedDateInputFieldUtils"

/** Segmented control for `date` or `datetime` with optional calendar popover. */
export function DateLikeSegmentedInputField(
  props: DateLikeFieldProps,
  forwardedRef: React.ForwardedRef<HTMLInputElement>,
) {
  const base = useSegmentedFieldBase(props, forwardedRef)
  const granularity = props.kind === "date" ? dayGranularity : minuteGranularity
  const parsedValue = parseDateLikeValue(props.kind, base.value)
  const parsedDefaultValue = parseDateLikeValue(props.kind, base.defaultValue)
  const [uncontrolledValue, setUncontrolledValue] = useState<DateValue | null>(
    parsedDefaultValue ?? null,
  )
  const [pickerResetKey, setPickerResetKey] = useState(0)
  const previousControlledValue = useRef("")
  const currentValue = base.isControlled ? (parsedValue ?? null) : uncontrolledValue
  const serializedControlledValue = typeof base.value === "string" ? base.value : ""

  useEffect(() => {
    if (!base.isControlled) {
      return
    }

    if (previousControlledValue.current.length > 0 && serializedControlledValue.length === 0) {
      setPickerResetKey((current) => current + 1)
    }

    previousControlledValue.current = serializedControlledValue
  }, [base.isControlled, serializedControlledValue])

  const commitValue = (nextValue: DateValue | null) => {
    if (!base.isControlled) {
      setUncontrolledValue(nextValue)
    }

    emitSyntheticChange(
      base.hiddenInputRef.current,
      base.onChange,
      serializeDateLikeInputValue(props.kind, nextValue, minuteGranularity),
    )
  }

  return (
    <DateLikePickerInner
      key={pickerResetKey}
      base={base}
      currentValue={currentValue}
      granularity={granularity}
      kind={props.kind}
      onClear={() => {
        if (!base.isControlled) {
          setUncontrolledValue(null)
          setPickerResetKey((current) => current + 1)
        }

        emitSyntheticChange(base.hiddenInputRef.current, base.onChange, "")
      }}
      onCommitValue={commitValue}
    />
  )
}
