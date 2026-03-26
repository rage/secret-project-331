import { parseDate, parseDateTime, parseTime } from "@internationalized/date"
import React, { useId, useImperativeHandle, useRef, useState } from "react"
import type { DateValue, TimeValue } from "react-aria"
import { useLocale } from "react-aria"

import { resolveFieldState } from "../../../lib/utils/field"
import type { NativeInputFieldProps } from "../NativeInputField"

import type { SegmentedDateInputFieldProps } from "./segmentTypes"

/** True when the floating label is at rest with no committed value: hide segment placeholders until focus or value. */
export function shouldHideRestSegmentPlaceholders(
  layout: "floating" | "stacked",
  isFocused: boolean,
  hasValue: boolean,
  isPickerOpen?: boolean,
): boolean {
  if (layout !== "floating") {
    return false
  }

  if (isFocused) {
    return false
  }

  if (hasValue) {
    return false
  }

  if (isPickerOpen === true) {
    return false
  }

  return true
}

export function padNumber(value: number, minimumLength = 2) {
  return String(value).padStart(minimumLength, "0")
}

export function hasDateParts(value: DateValue | TimeValue): value is DateValue & {
  year: number
  month: number
  day: number
} {
  return "year" in value && "month" in value && "day" in value
}

export function hasTimeParts(value: DateValue | TimeValue): value is TimeValue & {
  hour: number
  minute: number
  second: number
} {
  return "hour" in value && "minute" in value && "second" in value
}

export function formatDateValue(value: { year: number; month: number; day: number }) {
  return `${padNumber(value.year, 4)}-${padNumber(value.month)}-${padNumber(value.day)}`
}

export function formatTimeValue(
  value: { hour: number; minute: number; second: number },
  granularity: "hour" | "minute" | "second",
) {
  const hour = padNumber(value.hour)

  if (granularity === "hour") {
    return hour
  }

  const minute = padNumber(value.minute)

  if (granularity === "minute") {
    return `${hour}:${minute}`
  }

  return `${hour}:${minute}:${padNumber(value.second)}`
}

export function parseDateLikeValue(
  kind: "date" | "datetime",
  value: string | number | readonly string[] | undefined,
) {
  if (typeof value !== "string" || value.length === 0) {
    return undefined
  }

  try {
    return kind === "date" ? parseDate(value) : parseDateTime(value)
  } catch {
    return undefined
  }
}

export function parseTimeOnlyValue(value: string | number | readonly string[] | undefined) {
  if (typeof value !== "string" || value.length === 0) {
    return undefined
  }

  try {
    return parseTime(value)
  } catch {
    return undefined
  }
}

export function serializeDateValue(value: DateValue | null) {
  return value && hasDateParts(value) ? formatDateValue(value) : ""
}

export function serializeTimeValue(
  value: TimeValue | null,
  granularity: "hour" | "minute" | "second",
) {
  return value && hasTimeParts(value) ? formatTimeValue(value, granularity) : ""
}

export function serializeDateTimeValue(
  value: DateValue | null,
  granularity: "hour" | "minute" | "second",
) {
  if (!value || !hasDateParts(value) || !hasTimeParts(value)) {
    return ""
  }

  return `${formatDateValue(value)}T${formatTimeValue(value, granularity)}`
}

export function serializeDateLikeInputValue(
  kind: "date" | "datetime",
  value: DateValue | null,
  granularity: "hour" | "minute" | "second",
) {
  return kind === "date" ? serializeDateValue(value) : serializeDateTimeValue(value, granularity)
}

export function resolveMinuteStep(step: NativeInputFieldProps["step"]) {
  if (step === undefined || step === "any") {
    return 5
  }

  const numericStep = typeof step === "number" ? step : Number(step)

  if (!Number.isFinite(numericStep) || numericStep <= 0) {
    return 1
  }

  const minuteStep = numericStep / 60

  if (!Number.isInteger(minuteStep) || minuteStep < 1 || minuteStep > 59) {
    return 1
  }

  return minuteStep
}

export function emitSyntheticChange(
  input: HTMLInputElement | null,
  onChange: NativeInputFieldProps["onChange"],
  nextValue: string,
) {
  if (!input) {
    return
  }

  input.value = nextValue

  if (!onChange) {
    return
  }

  const syntheticEvent = {
    currentTarget: input,
    target: input,
  } as React.ChangeEvent<HTMLInputElement>

  onChange(syntheticEvent)
}

/** Shared refs, ids, and field chrome state for segmented date/time fields. */
export function useSegmentedFieldBase(
  props: SegmentedDateInputFieldProps,
  forwardedRef: React.ForwardedRef<HTMLInputElement>,
) {
  const {
    id,
    label,
    description,
    errorMessage,
    notice,
    fieldSize = "md",
    isDisabled,
    isReadOnly,
    isRequired,
    isInvalid,
    iconStart,
    iconEnd,
    layout = "stacked",
    className,
    disabled,
    readOnly,
    required,
    value,
    defaultValue,
    onChange,
    onBlur,
    onFocus,
    min,
    max,
    step,
    hourCycle,
    "aria-invalid": ariaInvalid,
    ...rest
  } = props

  const { locale } = useLocale()
  const generatedInputId = useId()
  const noticeId = useId()
  const hiddenInputRef = useRef<HTMLInputElement>(null)
  const groupRef = useRef<HTMLDivElement>(null)
  const fieldRef = useRef<HTMLDivElement>(null)
  const [isFocused, setIsFocused] = useState(false)

  useImperativeHandle(forwardedRef, () => hiddenInputRef.current as HTMLInputElement)

  return {
    className,
    defaultValue,
    description,
    errorMessage,
    fieldRef,
    fieldSize,
    groupRef,
    hiddenInputRef,
    hourCycle,
    iconEnd,
    iconStart,
    id: id ?? generatedInputId,
    isControlled: value !== undefined,
    isFocused,
    label,
    layout,
    locale,
    max,
    min,
    notice,
    noticeId,
    onBlur,
    onChange,
    onFocus,
    resolvedState: resolveFieldState({
      disabled,
      readOnly,
      required,
      isDisabled,
      isReadOnly,
      isRequired,
      isInvalid,
      ariaInvalid,
      errorMessage,
    }),
    rest,
    setIsFocused,
    step,
    value,
  }
}

export type SegmentedFieldBase = ReturnType<typeof useSegmentedFieldBase>
