import React, { useId, useImperativeHandle, useRef, useState } from "react"
import { useLocale } from "react-aria"

import {
  emitSyntheticChange as emitCompositeSyntheticChange,
  findFirstMatchingChild,
} from "../../../lib/utils/compositeField"
import { resolveFieldState } from "../../../lib/utils/field"
import {
  parseDateLikeValue,
  parseTimeOnlyValue,
  resolveMinuteStep,
  serializeDateLikeInputValue,
  serializeDateTimeValue,
  serializeDateValue,
  serializeTimeValue,
  shouldHideRestSegmentPlaceholders,
} from "../../../lib/utils/segmentedField"

import type { SegmentedDateInputFieldProps } from "./segmentTypes"

export {
  parseDateLikeValue,
  parseTimeOnlyValue,
  resolveMinuteStep,
  serializeDateLikeInputValue,
  serializeDateTimeValue,
  serializeDateValue,
  serializeTimeValue,
  shouldHideRestSegmentPlaceholders,
}

export function emitSyntheticChange(
  input: HTMLInputElement | null,
  onChange: React.ChangeEventHandler<HTMLInputElement> | undefined,
  nextValue: string,
) {
  emitCompositeSyntheticChange(input, onChange, nextValue)
}

/** Shared refs, ids, and field chrome state for segmented date/time fields. */
export function useSegmentedFieldBase(
  props: SegmentedDateInputFieldProps,
  forwardedRef: React.ForwardedRef<HTMLDivElement>,
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
    onValueChange,
    onBlur,
    onFocus,
    inputRef,
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

  useImperativeHandle(forwardedRef, () => {
    return (findFirstMatchingChild<HTMLDivElement>(fieldRef.current, '[role="spinbutton"]') ??
      findFirstMatchingChild<HTMLDivElement>(groupRef.current, '[role="spinbutton"]') ??
      fieldRef.current ??
      groupRef.current) as HTMLDivElement
  })

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
    inputRef,
    isControlled: value !== undefined,
    isFocused,
    label,
    layout,
    locale,
    max,
    min,
    notice,
    noticeId,
    onChange,
    onValueChange,
    externalOnBlur: onBlur,
    externalOnFocus: onFocus,
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
