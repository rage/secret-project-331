"use client"

import { css, cx } from "@emotion/css"
import { createCalendar, parseDate, parseDateTime, parseTime } from "@internationalized/date"
import {
  type DateFieldState,
  useDateFieldState,
  useTimeFieldState,
} from "@react-stately/datepicker"
import React, { useId, useImperativeHandle, useRef, useState } from "react"
import {
  type DateFieldAria,
  type DateValue,
  type TimeValue,
  useDateField,
  useDateSegment,
  useLocale,
  useTimeField,
} from "react-aria"

import { joinAriaDescribedBy, resolveFieldState } from "../../lib/utils/field"

import { FieldShell } from "./FieldShell"
import type { NativeInputFieldProps } from "./NativeInputField"
import {
  type FieldSize,
  inlineAffixCss,
  inputWithFloatingLabelCss,
  resolveControlSurfaceCss,
} from "./fieldStyles"

type SegmentedFieldKind = "date" | "time" | "datetime"

export type SegmentedDateInputFieldProps = Omit<NativeInputFieldProps, "type"> & {
  kind: SegmentedFieldKind
}

type DateLikeFieldProps = SegmentedDateInputFieldProps & {
  kind: "date" | "datetime"
}

type TimeOnlyFieldProps = SegmentedDateInputFieldProps & {
  kind: "time"
}

const floatingLabelOffsetDefaultCss = css`
  --field-floating-label-offset: 16px;
`

const floatingLabelOffsetWithAffixCss = css`
  --field-floating-label-offset: 42px;
`

const segmentedFieldCss = css`
  flex: 1 1 auto;
  min-width: 0;
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 2px;
  color: inherit;
  outline: none;
`

const segmentedFieldDisabledCss = css`
  cursor: not-allowed;
`

const segmentedFieldReadOnlyCss = css`
  cursor: default;
`

const segmentCss = css`
  position: relative;
  min-width: 1ch;
  padding: 2px 0;
  border-radius: 4px;
  color: inherit;
  outline: none;

  &:focus-visible {
    background: rgba(8, 69, 122, 0.08);
  }
`

const segmentPlaceholderCss = css`
  color: var(--field-placeholder);
`

const segmentLiteralCss = css`
  color: var(--field-chrome);
  user-select: none;
`

// eslint-disable-next-line i18next/no-literal-string
const dataStateFalse = "false"
// eslint-disable-next-line i18next/no-literal-string
const dataStateTrue = "true"
// eslint-disable-next-line i18next/no-literal-string
const dayGranularity = "day" as const
// eslint-disable-next-line i18next/no-literal-string
const minuteGranularity = "minute" as const

function padNumber(value: number, minimumLength = 2) {
  return String(value).padStart(minimumLength, "0")
}

function hasDateParts(value: DateValue | TimeValue): value is DateValue & {
  year: number
  month: number
  day: number
} {
  return "year" in value && "month" in value && "day" in value
}

function hasTimeParts(value: DateValue | TimeValue): value is TimeValue & {
  hour: number
  minute: number
  second: number
} {
  return "hour" in value && "minute" in value && "second" in value
}

function formatDateValue(value: { year: number; month: number; day: number }) {
  return `${padNumber(value.year, 4)}-${padNumber(value.month)}-${padNumber(value.day)}`
}

function formatTimeValue(
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

function parseDateLikeValue(
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

function parseTimeOnlyValue(value: string | number | readonly string[] | undefined) {
  if (typeof value !== "string" || value.length === 0) {
    return undefined
  }

  try {
    return parseTime(value)
  } catch {
    return undefined
  }
}

function serializeDateValue(value: DateValue | null) {
  return value && hasDateParts(value) ? formatDateValue(value) : ""
}

function serializeTimeValue(value: TimeValue | null, granularity: "hour" | "minute" | "second") {
  return value && hasTimeParts(value) ? formatTimeValue(value, granularity) : ""
}

function serializeDateTimeValue(
  value: DateValue | null,
  granularity: "hour" | "minute" | "second",
) {
  if (!value || !hasDateParts(value) || !hasTimeParts(value)) {
    return ""
  }

  return `${formatDateValue(value)}T${formatTimeValue(value, granularity)}`
}

function emitSyntheticChange(
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

function useSegmentedFieldBase(
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
    "aria-invalid": ariaInvalid,
    ...rest
  } = props

  const { locale } = useLocale()
  const generatedInputId = useId()
  const noticeId = useId()
  const hiddenInputRef = useRef<HTMLInputElement>(null)
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
    hiddenInputRef,
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
    value,
  }
}

function DateSegment({
  segment,
  state,
}: {
  segment: DateFieldState["segments"][number]
  state: DateFieldState
}) {
  const ref = useRef<HTMLDivElement>(null)
  const { segmentProps } = useDateSegment(segment, state, ref)

  return (
    <div
      {...segmentProps}
      ref={ref}
      className={cx(
        segmentCss,
        segment.isPlaceholder ? segmentPlaceholderCss : undefined,
        segment.type === "literal" ? segmentLiteralCss : undefined,
      )}
    >
      {segment.text}
    </div>
  )
}

function renderSegmentedField({
  aria,
  className,
  description,
  errorMessage,
  fieldRef,
  fieldSize,
  hiddenInputRef,
  hiddenInputValue,
  iconEnd,
  iconStart,
  isFocused,
  label,
  layout,
  notice,
  noticeId,
  resolvedState,
  setIsFocused,
  state,
}: {
  aria: DateFieldAria
  className?: string
  description?: React.ReactNode
  errorMessage?: React.ReactNode
  fieldRef: React.RefObject<HTMLDivElement | null>
  fieldSize: FieldSize
  hiddenInputRef: React.RefObject<HTMLInputElement | null>
  hiddenInputValue: string
  iconEnd?: React.ReactNode
  iconStart?: React.ReactNode
  isFocused: boolean
  label: React.ReactNode
  layout: "floating" | "stacked"
  notice?: React.ReactNode
  noticeId: string
  resolvedState: ReturnType<typeof resolveFieldState>
  setIsFocused: React.Dispatch<React.SetStateAction<boolean>>
  state: DateFieldState
}) {
  const describedBy = joinAriaDescribedBy(
    typeof aria.fieldProps["aria-describedby"] === "string"
      ? aria.fieldProps["aria-describedby"]
      : undefined,
    notice ? noticeId : undefined,
  )

  return (
    <FieldShell
      className={className}
      controlClassName={cx(
        resolveControlSurfaceCss(fieldSize, layout === "floating"),
        iconStart ? floatingLabelOffsetWithAffixCss : floatingLabelOffsetDefaultCss,
      )}
      controlProps={{
        "data-disabled": resolvedState.isDisabled ? dataStateTrue : dataStateFalse,
        "data-invalid": state.isInvalid ? dataStateTrue : dataStateFalse,
        "data-readonly": resolvedState.isReadOnly ? dataStateTrue : dataStateFalse,
      }}
      label={label}
      labelProps={label ? (aria.labelProps as React.HTMLAttributes<HTMLElement>) : undefined}
      description={description}
      descriptionId={
        description && typeof aria.descriptionProps.id === "string"
          ? aria.descriptionProps.id
          : undefined
      }
      errorMessage={errorMessage}
      errorMessageId={
        errorMessage && typeof aria.errorMessageProps.id === "string"
          ? aria.errorMessageProps.id
          : undefined
      }
      notice={notice}
      noticeId={notice ? noticeId : undefined}
      isDisabled={resolvedState.isDisabled}
      isRequired={resolvedState.isRequired}
      layout={layout}
      isFloatingRaised={layout === "floating" ? isFocused || state.value != null : true}
    >
      {iconStart ? <span className={inlineAffixCss}>{iconStart}</span> : null}
      <div
        {...aria.fieldProps}
        ref={fieldRef}
        className={cx(
          segmentedFieldCss,
          layout === "floating" ? inputWithFloatingLabelCss : undefined,
          resolvedState.isDisabled ? segmentedFieldDisabledCss : undefined,
          resolvedState.isReadOnly ? segmentedFieldReadOnlyCss : undefined,
        )}
        aria-disabled={resolvedState.isDisabled ? dataStateTrue : undefined}
        aria-describedby={describedBy}
        aria-invalid={state.isInvalid ? dataStateTrue : undefined}
        aria-readonly={resolvedState.isReadOnly ? dataStateTrue : undefined}
        aria-required={resolvedState.isRequired ? dataStateTrue : undefined}
        onBlur={(event) => {
          if (!fieldRef.current?.contains(event.relatedTarget as Node | null)) {
            setIsFocused(false)
          }

          aria.fieldProps.onBlur?.(event)
        }}
        onFocus={(event) => {
          setIsFocused(true)
          aria.fieldProps.onFocus?.(event)
        }}
      >
        {state.segments.map((segment: DateFieldState["segments"][number], index: number) => (
          <DateSegment key={`${segment.type}-${index}`} segment={segment} state={state} />
        ))}
      </div>
      <input
        {...aria.inputProps}
        ref={hiddenInputRef}
        type="hidden"
        aria-describedby={describedBy}
        value={hiddenInputValue}
        onChange={() => {
          return
        }}
      />
      {iconEnd ? <span className={inlineAffixCss}>{iconEnd}</span> : null}
    </FieldShell>
  )
}

function DateLikeSegmentedInputField(
  props: DateLikeFieldProps,
  forwardedRef: React.ForwardedRef<HTMLInputElement>,
) {
  const base = useSegmentedFieldBase(props, forwardedRef)
  const granularity = props.kind === "date" ? dayGranularity : minuteGranularity
  const parsedValue = parseDateLikeValue(props.kind, base.value)
  const parsedDefaultValue = parseDateLikeValue(props.kind, base.defaultValue)
  const parsedMinValue = parseDateLikeValue(props.kind, base.min)
  const parsedMaxValue = parseDateLikeValue(props.kind, base.max)

  const fieldProps = {
    ...base.rest,
    id: base.id,
    inputRef: base.hiddenInputRef,
    label: base.label,
    description: base.description,
    errorMessage: base.errorMessage,
    locale: base.locale,
    createCalendar,
    granularity,
    value: base.isControlled ? (parsedValue ?? null) : undefined,
    defaultValue: base.defaultValue !== undefined ? (parsedDefaultValue ?? null) : undefined,
    minValue: parsedMinValue,
    maxValue: parsedMaxValue,
    isDisabled: base.resolvedState.isDisabled,
    isReadOnly: base.resolvedState.isReadOnly,
    isRequired: base.resolvedState.isRequired,
    isInvalid: base.resolvedState.isInvalid,
    onBlur: base.onBlur as React.FocusEventHandler<Element> | undefined,
    onChange: (nextValue: DateValue | null) => {
      emitSyntheticChange(
        base.hiddenInputRef.current,
        base.onChange,
        props.kind === "date"
          ? serializeDateValue(nextValue)
          : serializeDateTimeValue(nextValue, minuteGranularity),
      )
    },
    onFocus: base.onFocus as React.FocusEventHandler<Element> | undefined,
  }

  const state = useDateFieldState(fieldProps)
  const aria = useDateField(fieldProps, state, base.fieldRef)

  return renderSegmentedField({
    aria,
    className: base.className,
    description: base.description,
    errorMessage: base.errorMessage,
    fieldRef: base.fieldRef,
    fieldSize: base.fieldSize,
    hiddenInputRef: base.hiddenInputRef,
    hiddenInputValue:
      props.kind === "date"
        ? serializeDateValue(state.value)
        : serializeDateTimeValue(state.value, minuteGranularity),
    iconEnd: base.iconEnd,
    iconStart: base.iconStart,
    isFocused: base.isFocused,
    label: base.label,
    layout: base.layout,
    notice: base.notice,
    noticeId: base.noticeId,
    resolvedState: base.resolvedState,
    setIsFocused: base.setIsFocused,
    state,
  })
}

function TimeSegmentedInputField(
  props: TimeOnlyFieldProps,
  forwardedRef: React.ForwardedRef<HTMLInputElement>,
) {
  const base = useSegmentedFieldBase(props, forwardedRef)
  const granularity = minuteGranularity
  const parsedValue = parseTimeOnlyValue(base.value)
  const parsedDefaultValue = parseTimeOnlyValue(base.defaultValue)
  const parsedMinValue = parseTimeOnlyValue(base.min)
  const parsedMaxValue = parseTimeOnlyValue(base.max)

  const fieldProps = {
    ...base.rest,
    id: base.id,
    inputRef: base.hiddenInputRef,
    label: base.label,
    description: base.description,
    errorMessage: base.errorMessage,
    locale: base.locale,
    granularity,
    value: base.isControlled ? (parsedValue ?? null) : undefined,
    defaultValue: base.defaultValue !== undefined ? (parsedDefaultValue ?? null) : undefined,
    minValue: parsedMinValue,
    maxValue: parsedMaxValue,
    isDisabled: base.resolvedState.isDisabled,
    isReadOnly: base.resolvedState.isReadOnly,
    isRequired: base.resolvedState.isRequired,
    isInvalid: base.resolvedState.isInvalid,
    onBlur: base.onBlur as React.FocusEventHandler<Element> | undefined,
    onChange: (nextValue: TimeValue | null) => {
      emitSyntheticChange(
        base.hiddenInputRef.current,
        base.onChange,
        serializeTimeValue(nextValue, granularity),
      )
    },
    onFocus: base.onFocus as React.FocusEventHandler<Element> | undefined,
  }

  const state = useTimeFieldState(fieldProps)
  const aria = useTimeField(fieldProps, state, base.fieldRef)

  return renderSegmentedField({
    aria,
    className: base.className,
    description: base.description,
    errorMessage: base.errorMessage,
    fieldRef: base.fieldRef,
    fieldSize: base.fieldSize,
    hiddenInputRef: base.hiddenInputRef,
    hiddenInputValue: serializeTimeValue(state.value as TimeValue | null, granularity),
    iconEnd: base.iconEnd,
    iconStart: base.iconStart,
    isFocused: base.isFocused,
    label: base.label,
    layout: base.layout,
    notice: base.notice,
    noticeId: base.noticeId,
    resolvedState: base.resolvedState,
    setIsFocused: base.setIsFocused,
    state,
  })
}

const ForwardedDateLikeSegmentedInputField = React.forwardRef<HTMLInputElement, DateLikeFieldProps>(
  DateLikeSegmentedInputField,
)

const ForwardedTimeSegmentedInputField = React.forwardRef<HTMLInputElement, TimeOnlyFieldProps>(
  TimeSegmentedInputField,
)

export const SegmentedDateInputField = React.forwardRef<
  HTMLInputElement,
  SegmentedDateInputFieldProps
>(function SegmentedDateInputField(props, forwardedRef) {
  if (props.kind === "time") {
    return (
      <ForwardedTimeSegmentedInputField {...(props as TimeOnlyFieldProps)} ref={forwardedRef} />
    )
  }

  return (
    <ForwardedDateLikeSegmentedInputField {...(props as DateLikeFieldProps)} ref={forwardedRef} />
  )
})
