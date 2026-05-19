import React, { useId, useImperativeHandle, useRef, useState } from "react"
import { useLocale } from "react-aria"

import { findFirstMatchingChild } from "../../../lib/utils/compositeField"
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

type HiddenFormInput = HTMLInputElement

function syncHiddenInputValue(input: HiddenFormInput | null, nextValue: string) {
  if (!input) {
    return
  }
  input.value = nextValue
}

function createSyntheticChangeTarget(input: HiddenFormInput, nextValue: string): HiddenFormInput {
  const eventTarget = input.cloneNode(true) as HiddenFormInput
  syncHiddenInputValue(eventTarget, nextValue)
  return eventTarget
}

/** Notifies `onChange` with a synthetic event so RHF/native listeners see the hidden input value. */
export function emitSyntheticChange(
  input: HTMLInputElement | null,
  onChange: React.ChangeEventHandler<HTMLInputElement> | undefined,
  nextValue: string,
) {
  if (!input) {
    return
  }
  syncHiddenInputValue(input, nextValue)
  if (!onChange) {
    return
  }
  const eventTarget = createSyntheticChangeTarget(input, nextValue)
  onChange({
    currentTarget: eventTarget,
    target: eventTarget,
    type: "change",
  } as React.ChangeEvent<HTMLInputElement>)
}

/** Invokes `onBlur` as if it fired on the hidden input (RHF `onBlur` / touch). */
export function emitSyntheticBlur(
  input: HTMLInputElement | null,
  onBlur: React.FocusEventHandler<HTMLInputElement> | undefined,
) {
  if (!input || !onBlur) {
    return
  }
  onBlur({
    currentTarget: input,
    target: input,
    type: "blur",
    relatedTarget: null,
  } as React.FocusEvent<HTMLInputElement>)
}

/** Invokes `onFocus` as if it fired on the hidden input. */
export function emitSyntheticFocus(
  input: HTMLInputElement | null,
  onFocus: React.FocusEventHandler<HTMLInputElement> | undefined,
) {
  if (!input || !onFocus) {
    return
  }
  onFocus({
    currentTarget: input,
    target: input,
    type: "focus",
    relatedTarget: null,
  } as React.FocusEvent<HTMLInputElement>)
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
    value,
    onChange,
    onValueChange,
    onBlur,
    onFocus,
    inputRef,
    min,
    max,
    step,
    hourCycle,
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
      isDisabled,
      isReadOnly,
      isRequired,
      isInvalid,
      errorMessage,
    }),
    setIsFocused,
    step,
    value,
  }
}

export type SegmentedFieldBase = ReturnType<typeof useSegmentedFieldBase>
