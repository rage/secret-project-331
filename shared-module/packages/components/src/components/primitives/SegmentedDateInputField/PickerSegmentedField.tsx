"use client"

import { cx } from "@emotion/css"
import type { DateFieldState } from "@react-stately/datepicker"
import { useDatePickerState } from "@react-stately/datepicker"
import type React from "react"
import type { DateFieldAria, DatePickerAria, DateValue, TimeValue } from "react-aria"

import { composeRefs } from "../../../lib/utils/compositeField"
import { joinAriaDescribedBy, resolveFieldState } from "../../../lib/utils/field"
import { DatePickerCalendar } from "../DatePickerCalendar"
import { FieldShell } from "../FieldShell"
import {
  type FieldSize,
  inlineAffixCss,
  resolveControlSurfaceCss,
  resolveSegmentedFloatingShellCss,
} from "../fieldStyles"
import { Popover } from "../popover"

import { DatePickerTriggerButton } from "./DatePickerTriggerButton"
import { DateSegment } from "./DateSegment"
import { dataStateFalse, dataStateTrue } from "./segmentedDateInputFieldConstants"
import {
  segmentedFieldDisabledCss,
  segmentedFieldReadOnlyCss,
  segmentedFieldShellCss,
  segmentedFieldShellRestEmptyCss,
  segmentedPickerFieldCss,
  segmentedPickerGroupCss,
  segmentedSegmentsRowCss,
  segmentedSegmentsRowRestHiddenCss,
} from "./segmentedDateInputFieldStyles"
import {
  emitSyntheticBlur,
  emitSyntheticFocus,
  shouldHideRestSegmentPlaceholders,
} from "./segmentedDateInputFieldUtils"

export type PickerSegmentedFieldProps = {
  canClear: boolean
  className?: string
  dateFieldAria: DateFieldAria
  description?: React.ReactNode
  errorMessage?: React.ReactNode
  externalOnBlur?: React.FocusEventHandler<HTMLElement>
  externalOnFocus?: React.FocusEventHandler<HTMLElement>
  fieldRef: React.RefObject<HTMLDivElement | null>
  fieldSize: FieldSize
  groupRef: React.RefObject<HTMLDivElement | null>
  hiddenInputRef: React.RefObject<HTMLInputElement | null>
  hiddenInputValue: string
  inputRef?: React.Ref<HTMLInputElement>
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
}

/** Segmented date/datetime field with calendar popover and optional time column. */
export function PickerSegmentedField({
  canClear,
  className,
  dateFieldAria,
  description,
  errorMessage,
  externalOnBlur,
  externalOnFocus,
  fieldRef,
  fieldSize,
  groupRef,
  hiddenInputRef,
  hiddenInputValue,
  inputRef,
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
}: PickerSegmentedFieldProps) {
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
      descriptionProps={pickerAria.descriptionProps as React.HTMLAttributes<HTMLElement>}
      errorMessage={errorMessage}
      errorMessageProps={pickerAria.errorMessageProps as React.HTMLAttributes<HTMLElement>}
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
          const isLeavingGroup = !groupRef.current?.contains(event.relatedTarget as Node | null)

          if (isLeavingGroup) {
            setIsFocused(false)
            emitSyntheticBlur(
              hiddenInputRef.current,
              externalOnBlur as React.FocusEventHandler<HTMLInputElement> | undefined,
            )
          }

          pickerAria.groupProps.onBlur?.(event)
        }}
        onFocus={(event) => {
          if (!isFocused) {
            emitSyntheticFocus(
              hiddenInputRef.current,
              externalOnFocus as React.FocusEventHandler<HTMLInputElement> | undefined,
            )
          }

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
        ref={composeRefs(hiddenInputRef, inputRef)}
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
