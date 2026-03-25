"use client"

import { css, cx } from "@emotion/css"
import {
  createCalendar,
  getLocalTimeZone,
  GregorianCalendar,
  now,
  parseDate,
  parseDateTime,
  parseTime,
  toCalendar,
  toCalendarDate,
  toTime,
} from "@internationalized/date"
import {
  type DateFieldState,
  useDateFieldState,
  useDatePickerState,
  useTimeFieldState,
} from "@react-stately/datepicker"
import React, { useEffect, useId, useImperativeHandle, useRef, useState } from "react"
import {
  type AriaButtonProps,
  type DateFieldAria,
  type DatePickerAria,
  type DateValue,
  type TimeValue,
  useButton,
  useDateField,
  useDatePicker,
  useDateSegment,
  useLocale,
  useTimeField,
} from "react-aria"

import { joinAriaDescribedBy, resolveFieldState } from "../../lib/utils/field"

import { DatePickerCalendar } from "./DatePickerCalendar"
import { FieldShell } from "./FieldShell"
import type { NativeInputFieldProps } from "./NativeInputField"
import {
  fieldControlCss,
  type FieldSize,
  inlineAffixCss,
  resolveControlSurfaceCss,
  resolveSegmentedFloatingShellCss,
} from "./fieldStyles"
import { Popover } from "./popover"

type SegmentedFieldKind = "date" | "time" | "datetime"

export type SegmentedTemporalFieldProps = Omit<NativeInputFieldProps, "type"> & {
  hourCycle?: 12 | 24
}

export type SegmentedDateInputFieldProps = SegmentedTemporalFieldProps & {
  kind: SegmentedFieldKind
}

type DateLikeFieldProps = SegmentedDateInputFieldProps & {
  kind: "date" | "datetime"
}

type TimeOnlyFieldProps = SegmentedDateInputFieldProps & {
  kind: "time"
}

/** Wraps the segment row; grows when a direct flex child of the control surface (non-picker). In the picker layout, width follows content; space before the calendar trigger sits in the picker row, not inside this shell. */
const segmentedFieldShellCss = css`
  flex: 1 1 auto;
  min-width: 0;
  width: 100%;
  color: inherit;
  outline: none;
`

/** Single tight row of date/time segments (no wrap, no flex-grow between parts). */
const segmentedSegmentsRowCss = css`
  display: inline-flex;
  max-width: 100%;
  min-width: 0;
  flex-wrap: nowrap;
  align-items: baseline;
  justify-content: flex-start;
  gap: 2px;
  white-space: nowrap;
`

const segmentedFieldDisabledCss = css`
  cursor: not-allowed;
`

const segmentedFieldReadOnlyCss = css`
  cursor: default;
`

const segmentedPickerGroupCss = css`
  flex: 1 1 auto;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: var(--space-2);
`

const segmentedPickerFieldCss = css`
  flex: 0 1 auto;
  min-width: 0;
`

const segmentCss = css`
  position: relative;
  flex: 0 0 auto;
  min-width: 1ch;
  padding: 2px 0;
  border-radius: 4px;
  color: inherit;
  outline: none;
  font-variant-numeric: tabular-nums;

  &:focus-visible {
    background: var(--color-blue-50);
  }
`

const segmentPlaceholderCss = css`
  color: var(--field-placeholder);
`

const segmentLiteralCss = css`
  color: var(--field-chrome);
  user-select: none;
`

const datePickerButtonCss = css`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 auto;
  width: 32px;
  height: 32px;
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

const datePickerButtonIconCss = css`
  width: 18px;
  height: 18px;
`

/** Pins the calendar trigger to the trailing edge of the picker row so the segment cluster stays content-sized. */
const segmentedPickerTriggerCss = css`
  margin-inline-start: auto;
`

/** When the label is at rest (unfloated) with no value: no vertical padding on the shell so height matches TextField. */
const segmentedFieldShellRestEmptyCss = css`
  .${fieldControlCss}[data-floated="false"] & {
    padding-top: 0;
    padding-bottom: 0;
    min-height: 0;
  }
`

/** Hides placeholder segment glyphs while the label is at rest; keeps row in layout flow at zero height for focus. */
const segmentedSegmentsRowRestHiddenCss = css`
  visibility: hidden;
  height: 0;
  overflow: hidden;
  padding: 0;
  margin: 0;
  border: 0;
  line-height: 0;
  pointer-events: none;
`

/** True when the floating label is at rest with no committed value: hide segment placeholder row until focus or value. */
function shouldHideRestSegmentPlaceholders(
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

const datePickerPopoverCss = css`
  width: min(360px, calc(100vw - 32px));
  min-width: min(320px, calc(100vw - 32px));
`

const dateTimePickerPopoverCss = css`
  width: min(720px, calc(100vw - 32px));
  min-width: min(320px, calc(100vw - 32px));
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

function serializeDateLikeInputValue(
  kind: "date" | "datetime",
  value: DateValue | null,
  granularity: "hour" | "minute" | "second",
) {
  return kind === "date" ? serializeDateValue(value) : serializeDateTimeValue(value, granularity)
}

function resolveMinuteStep(step: NativeInputFieldProps["step"]) {
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

function CalendarIcon() {
  return (
    <svg
      aria-hidden="true"
      className={datePickerButtonIconCss}
      fill="none"
      viewBox="0 0 20 20"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect height="13" rx="2.5" stroke="currentColor" strokeWidth="1.5" width="15" x="2.5" y="4" />
      <path
        d="M6 2.5v3M14 2.5v3M2.5 8h15"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.5"
      />
    </svg>
  )
}

function DatePickerTriggerButton({ buttonProps }: { buttonProps: AriaButtonProps }) {
  const ref = useRef<HTMLButtonElement>(null)
  const { buttonProps: triggerProps } = useButton(buttonProps, ref)

  return (
    <button
      {...triggerProps}
      ref={ref}
      className={cx(datePickerButtonCss, segmentedPickerTriggerCss)}
      type="button"
    >
      <CalendarIcon />
    </button>
  )
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

  const hideRestSegmentPlaceholders = shouldHideRestSegmentPlaceholders(
    layout,
    isFocused,
    state.value != null,
  )

  return (
    <FieldShell
      className={className}
      controlClassName={cx(resolveControlSurfaceCss(fieldSize, layout === "floating"))}
      controlProps={{
        "data-disabled": resolvedState.isDisabled ? dataStateTrue : dataStateFalse,
        "data-invalid": state.isInvalid ? dataStateTrue : dataStateFalse,
        "data-readonly": resolvedState.isReadOnly ? dataStateTrue : dataStateFalse,
        "data-has-icon-start": iconStart ? dataStateTrue : undefined,
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
      fieldSize={fieldSize}
      isFloatingRaised={layout === "floating" ? isFocused || state.value != null : true}
      isFloatingFocused={layout === "floating" ? isFocused : false}
      isInvalid={state.isInvalid}
    >
      {iconStart ? <span className={inlineAffixCss}>{iconStart}</span> : null}
      <div
        {...aria.fieldProps}
        ref={fieldRef}
        className={cx(
          segmentedFieldShellCss,
          layout === "floating" && !hideRestSegmentPlaceholders
            ? resolveSegmentedFloatingShellCss(fieldSize)
            : undefined,
          layout === "floating" && hideRestSegmentPlaceholders
            ? segmentedFieldShellRestEmptyCss
            : undefined,
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
        <div
          className={cx(
            segmentedSegmentsRowCss,
            hideRestSegmentPlaceholders && segmentedSegmentsRowRestHiddenCss,
          )}
        >
          {state.segments.map((segment: DateFieldState["segments"][number], index: number) => (
            <DateSegment key={`${segment.type}-${index}`} segment={segment} state={state} />
          ))}
        </div>
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

function renderSegmentedPickerField({
  canClear,
  className,
  dateFieldAria,
  description,
  errorMessage,
  fieldRef,
  fieldSize,
  groupRef,
  hiddenInputRef,
  hiddenInputValue,
  iconEnd,
  iconStart,
  isFocused,
  label,
  layout,
  notice,
  noticeId,
  onClear,
  onSelectNextWeek,
  onSelectNow,
  onSelectToday,
  onSelectTomorrow,
  pickerAria,
  pickerState,
  popoverClassName,
  resolvedState,
  setIsFocused,
  state,
  timeSelectorProps,
}: {
  canClear: boolean
  className?: string
  dateFieldAria: DateFieldAria
  description?: React.ReactNode
  errorMessage?: React.ReactNode
  fieldRef: React.RefObject<HTMLDivElement | null>
  fieldSize: FieldSize
  groupRef: React.RefObject<HTMLDivElement | null>
  hiddenInputRef: React.RefObject<HTMLInputElement | null>
  hiddenInputValue: string
  iconEnd?: React.ReactNode
  iconStart?: React.ReactNode
  isFocused: boolean
  label: React.ReactNode
  layout: "floating" | "stacked"
  notice?: React.ReactNode
  noticeId: string
  onClear: () => void
  onSelectNextWeek?: (value: DateValue) => void
  onSelectNow?: () => void
  onSelectToday: (value: DateValue) => void
  onSelectTomorrow?: (value: DateValue) => void
  pickerAria: DatePickerAria
  pickerState: ReturnType<typeof useDatePickerState>
  popoverClassName: string
  resolvedState: ReturnType<typeof resolveFieldState>
  setIsFocused: React.Dispatch<React.SetStateAction<boolean>>
  state: DateFieldState
  timeSelectorProps?: {
    granularity: "hour" | "minute"
    hourCycle?: 12 | 24
    isDisabled?: boolean
    isReadOnly?: boolean
    minuteStep: number
    value: TimeValue | null
    onChange: (value: TimeValue) => void
  }
}) {
  const describedBy = joinAriaDescribedBy(
    typeof pickerAria.groupProps["aria-describedby"] === "string"
      ? pickerAria.groupProps["aria-describedby"]
      : undefined,
    notice ? noticeId : undefined,
  )

  const hideRestSegmentPlaceholders = shouldHideRestSegmentPlaceholders(
    layout,
    isFocused,
    state.value != null,
    pickerState.isOpen,
  )

  return (
    <FieldShell
      className={className}
      controlClassName={cx(resolveControlSurfaceCss(fieldSize, layout === "floating"))}
      controlProps={{
        "data-disabled": resolvedState.isDisabled ? dataStateTrue : dataStateFalse,
        "data-invalid": pickerState.isInvalid ? dataStateTrue : dataStateFalse,
        "data-readonly": resolvedState.isReadOnly ? dataStateTrue : dataStateFalse,
        "data-has-icon-start": iconStart ? dataStateTrue : undefined,
      }}
      label={label}
      labelProps={label ? (pickerAria.labelProps as React.HTMLAttributes<HTMLElement>) : undefined}
      description={description}
      descriptionId={
        description && typeof pickerAria.descriptionProps.id === "string"
          ? pickerAria.descriptionProps.id
          : undefined
      }
      errorMessage={errorMessage}
      errorMessageId={
        errorMessage && typeof pickerAria.errorMessageProps.id === "string"
          ? pickerAria.errorMessageProps.id
          : undefined
      }
      notice={notice}
      noticeId={notice ? noticeId : undefined}
      isDisabled={resolvedState.isDisabled}
      isRequired={resolvedState.isRequired}
      layout={layout}
      fieldSize={fieldSize}
      isFloatingRaised={
        layout === "floating" ? isFocused || state.value != null || pickerState.isOpen : true
      }
      isFloatingFocused={layout === "floating" ? isFocused || pickerState.isOpen : false}
      isInvalid={pickerState.isInvalid}
    >
      <div
        {...pickerAria.groupProps}
        ref={groupRef}
        className={segmentedPickerGroupCss}
        aria-describedby={describedBy}
        aria-disabled={resolvedState.isDisabled ? dataStateTrue : undefined}
        aria-invalid={pickerState.isInvalid ? dataStateTrue : undefined}
        aria-readonly={resolvedState.isReadOnly ? dataStateTrue : undefined}
        aria-required={resolvedState.isRequired ? dataStateTrue : undefined}
        onBlur={(event) => {
          if (!groupRef.current?.contains(event.relatedTarget as Node | null)) {
            setIsFocused(false)
          }

          pickerAria.groupProps.onBlur?.(event)
        }}
        onFocus={(event) => {
          setIsFocused(true)
          pickerAria.groupProps.onFocus?.(event)
        }}
      >
        {iconStart ? <span className={inlineAffixCss}>{iconStart}</span> : null}
        <div className={segmentedPickerFieldCss}>
          <div
            {...dateFieldAria.fieldProps}
            ref={fieldRef}
            className={cx(
              segmentedFieldShellCss,
              layout === "floating" && !hideRestSegmentPlaceholders
                ? resolveSegmentedFloatingShellCss(fieldSize)
                : undefined,
              layout === "floating" && hideRestSegmentPlaceholders
                ? segmentedFieldShellRestEmptyCss
                : undefined,
              resolvedState.isDisabled ? segmentedFieldDisabledCss : undefined,
              resolvedState.isReadOnly ? segmentedFieldReadOnlyCss : undefined,
            )}
            aria-describedby={describedBy}
            onBlur={(event) => {
              if (!groupRef.current?.contains(event.relatedTarget as Node | null)) {
                setIsFocused(false)
              }

              dateFieldAria.fieldProps.onBlur?.(event)
            }}
            onFocus={(event) => {
              setIsFocused(true)
              dateFieldAria.fieldProps.onFocus?.(event)
            }}
          >
            <div
              className={cx(
                segmentedSegmentsRowCss,
                hideRestSegmentPlaceholders && segmentedSegmentsRowRestHiddenCss,
              )}
            >
              {state.segments.map((segment: DateFieldState["segments"][number], index: number) => (
                <DateSegment key={`${segment.type}-${index}`} segment={segment} state={state} />
              ))}
            </div>
          </div>
        </div>
        {iconEnd ? <span className={inlineAffixCss}>{iconEnd}</span> : null}
        <DatePickerTriggerButton buttonProps={pickerAria.buttonProps} />
      </div>
      <input
        {...dateFieldAria.inputProps}
        ref={hiddenInputRef}
        type="hidden"
        aria-describedby={describedBy}
        value={hiddenInputValue}
        onChange={() => {
          return
        }}
      />
      {pickerState.isOpen ? (
        <Popover
          className={popoverClassName}
          state={pickerState}
          triggerRef={groupRef}
          placement="bottom start"
        >
          <DatePickerCalendar
            calendarProps={pickerAria.calendarProps}
            canClear={canClear}
            dialogProps={pickerAria.dialogProps}
            onClear={onClear}
            onSelectNextWeek={onSelectNextWeek}
            onSelectNow={onSelectNow}
            onSelectToday={onSelectToday}
            onSelectTomorrow={onSelectTomorrow}
            timeSelectorProps={timeSelectorProps}
          />
        </Popover>
      ) : null}
    </FieldShell>
  )
}

type SegmentedFieldBase = ReturnType<typeof useSegmentedFieldBase>

function DateLikePickerInner({
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
    ...base.rest,
    id: base.id,
    label: base.label,
    description: base.description,
    errorMessage: base.errorMessage,
    granularity,
    hourCycle: base.hourCycle,
    value: currentValue,
    minValue: parsedMinValue,
    maxValue: parsedMaxValue,
    isDisabled: base.resolvedState.isDisabled,
    isReadOnly: base.resolvedState.isReadOnly,
    isRequired: base.resolvedState.isRequired,
    isInvalid: base.resolvedState.isInvalid,
    shouldCloseOnSelect: kind === "date",
    onBlur: base.onBlur as React.FocusEventHandler<Element> | undefined,
    onChange: onCommitValue,
    onFocus: base.onFocus as React.FocusEventHandler<Element> | undefined,
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
    currentValue != null || pickerState.dateValue != null || pickerState.timeValue != null

  return renderSegmentedPickerField({
    canClear,
    className: base.className,
    dateFieldAria,
    description: base.description,
    errorMessage: base.errorMessage,
    fieldRef: base.fieldRef,
    fieldSize: base.fieldSize,
    groupRef: base.groupRef,
    hiddenInputRef: base.hiddenInputRef,
    hiddenInputValue: serializeDateLikeInputValue(kind, state.value, minuteGranularity),
    iconEnd: base.iconEnd,
    iconStart: base.iconStart,
    isFocused: base.isFocused,
    label: base.label,
    layout: base.layout,
    notice: base.notice,
    noticeId: base.noticeId,
    onClear: () => {
      pickerState.setOpen(false)
      onClear()
    },
    onSelectNextWeek: (value) => {
      if (kind === "date") {
        pickerState.setValue(value)
        pickerState.setOpen(false)
        return
      }

      pickerState.setDateValue(value)
    },
    onSelectNow:
      kind === "datetime"
        ? () => {
            const zdt = now(getLocalTimeZone())
            const calendar = currentValue?.calendar ?? new GregorianCalendar()
            const date = toCalendar(toCalendarDate(zdt), calendar)
            const time = toTime(zdt)
            pickerState.setDateValue(date)
            pickerState.setTimeValue(time)
          }
        : undefined,
    onSelectToday: (value) => {
      if (kind === "date") {
        pickerState.setValue(value)
        pickerState.setOpen(false)
        return
      }

      pickerState.setDateValue(value)
    },
    onSelectTomorrow: (value) => {
      if (kind === "date") {
        pickerState.setValue(value)
        pickerState.setOpen(false)
        return
      }

      pickerState.setDateValue(value)
    },
    pickerAria,
    pickerState,
    popoverClassName: kind === "date" ? datePickerPopoverCss : dateTimePickerPopoverCss,
    resolvedState: base.resolvedState,
    setIsFocused: base.setIsFocused,
    state,
    timeSelectorProps:
      kind === "datetime"
        ? {
            granularity: minuteGranularity,
            hourCycle: base.hourCycle,
            isDisabled: base.resolvedState.isDisabled,
            isReadOnly: base.resolvedState.isReadOnly,
            minuteStep: resolveMinuteStep(base.step),
            value: pickerState.timeValue,
            onChange: (nextValue) => {
              pickerState.setTimeValue(nextValue)
            },
          }
        : undefined,
  })
}

function DateLikeSegmentedInputField(
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
    hourCycle: base.hourCycle,
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
