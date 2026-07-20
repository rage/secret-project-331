"use client"

import React, { useEffect, useRef, useState } from "react"
import type { DateValue } from "react-aria"

import { DateLikePickerInner } from "./DateLikePickerInner"
import { dayGranularity, minuteGranularity } from "./segmentedDateInputFieldConstants"
import {
  emitSyntheticChange,
  parseDateLikeValue,
  serializeDateLikeInputValue,
  useSegmentedFieldBase,
} from "./segmentedDateInputFieldUtils"
import type { DateLikeFieldProps } from "./segmentTypes"

/** Segmented control for `date` or `datetime` with optional calendar popover. */
export function DateLikeSegmentedInputField(
  props: DateLikeFieldProps,
  forwardedRef: React.ForwardedRef<HTMLDivElement>,
) {
  const base = useSegmentedFieldBase(props, forwardedRef)
  const granularity = props.kind === "date" ? dayGranularity : minuteGranularity
  const currentValue = parseDateLikeValue(props.kind, base.value)
  const [pickerResetKey, setPickerResetKey] = useState(0)
  const previousSerializedValue = useRef("")
  const serializedValue = typeof base.value === "string" ? base.value : ""

  useEffect(() => {
    if (previousSerializedValue.current.length > 0 && serializedValue.length === 0) {
      setPickerResetKey((current) => current + 1)
    }
    previousSerializedValue.current = serializedValue
  }, [serializedValue])

  const commitValue = (nextValue: DateValue | null) => {
    const nextSerialized = serializeDateLikeInputValue(props.kind, nextValue, minuteGranularity)
    base.onValueChange?.(nextSerialized)
    emitSyntheticChange(base.hiddenInputRef.current, base.onChange, nextSerialized)
  }

  return (
    <DateLikePickerInner
      key={pickerResetKey}
      base={base}
      currentValue={currentValue ?? null}
      granularity={granularity}
      kind={props.kind}
      onClear={() => {
        base.onValueChange?.("")
        emitSyntheticChange(base.hiddenInputRef.current, base.onChange, "")
      }}
      onCommitValue={commitValue}
    />
  )
}
