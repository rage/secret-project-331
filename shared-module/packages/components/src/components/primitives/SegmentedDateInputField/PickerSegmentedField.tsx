"use client"

import { cx } from "@emotion/css"
import type { DateFieldState, useDatePickerState } from "@react-stately/datepicker"
import { useRef } from "react"
import type React from "react"
import { mergeProps, useFocusWithin } from "react-aria"
import type { DateFieldAria, DatePickerAria, DateValue, TimeValue } from "react-aria"

import { composeRefs } from "../../../lib/utils/compositeField"
import type { resolveFieldState } from "../../../lib/utils/field"
import { joinAriaDescribedBy } from "../../../lib/utils/field"
import { includeIf, omitUndefined } from "../../../lib/utils/nullability"
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

export interface PickerSegmentedFieldProps {
  canClear: boolean
  className?: string | undefined
  dateFieldAria: DateFieldAria
  description?: React.ReactNode
  errorMessage?: React.ReactNode
  externalOnBlur?: React.FocusEventHandler<HTMLElement> | undefined
  externalOnFocus?: React.FocusEventHandler<HTMLElement> | undefined
  fieldRef: React.RefObject<HTMLDivElement | null>
  fieldSize: FieldSize
  groupRef: React.RefObject<HTMLDivElement | null>
  hiddenInputRef: React.RefObject<HTMLInputElement | null>
  hiddenInputValue: string
  inputRef?: React.Ref<HTMLInputElement> | undefined
  iconEnd?: React.ReactNode
  iconStart?: React.ReactNode
  isFocused: boolean
  label: React.ReactNode
  layout: "floating" | "stacked"
  notice?: React.ReactNode
  noticeId: string
  onClear: () => void
  onSelectNextWeek?: ((value: DateValue) => void) | undefined
  onSelectNow?: (() => void) | undefined
  onSelectToday: (value: DateValue) => void
  onSelectTomorrow?: ((value: DateValue) => void) | undefined
  pickerAria: DatePickerAria
  pickerState: ReturnType<typeof useDatePickerState>
  popoverClassName: string
  resolvedState: ReturnType<typeof resolveFieldState>
  setIsFocused: React.Dispatch<React.SetStateAction<boolean>>
  state: DateFieldState
  timeSelectorProps?:
    | {
        granularity: "hour" | "minute"
        hourCycle?: 12 | 24
        isDisabled?: boolean
        isReadOnly?: boolean
        minuteStep: number
        value: TimeValue | null
        onChange: (value: TimeValue) => void
      }
    | undefined
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
    state.value !== null,
    pickerState.isOpen,
  )

  // The calendar popover is portaled outside this group, so focus moving into it reads as
  // "leaving" the group. Keep the latest open-state in a ref so the blur handler can suppress
  // committing blur (RHF touched / validate-on-blur) while the user interacts with the popover.
  const isPopoverOpenRef = useRef(pickerState.isOpen)
  isPopoverOpenRef.current = pickerState.isOpen

  // Track focus entering/leaving the whole group with react-aria's focus-within helper instead of
  // hand-rolled relatedTarget/contains checks (which mishandle relatedTarget === null and Safari,
  // and previously fired twice via the nested field + group handlers).
  const { focusWithinProps } = useFocusWithin({
    onFocusWithin: () => {
      emitSyntheticFocus(
        hiddenInputRef.current,
        externalOnFocus as React.FocusEventHandler<HTMLInputElement> | undefined,
      )
      setIsFocused(true)
    },
    onBlurWithin: () => {
      setIsFocused(false)
      if (!isPopoverOpenRef.current) {
        emitSyntheticBlur(
          hiddenInputRef.current,
          externalOnBlur as React.FocusEventHandler<HTMLInputElement> | undefined,
        )
      }
    },
  })

  return (
    <FieldShell
      controlClassName={cx(resolveControlSurfaceCss(fieldSize, layout === "floating"))}
      controlProps={{
        "data-disabled": resolvedState.isDisabled ? dataStateTrue : dataStateFalse,
        "data-invalid": pickerState.isInvalid ? dataStateTrue : dataStateFalse,
        "data-readonly": resolvedState.isReadOnly ? dataStateTrue : dataStateFalse,
        "data-has-icon-start": iconStart ? dataStateTrue : undefined,
      }}
      label={label}
      description={description}
      descriptionProps={pickerAria.descriptionProps as React.HTMLAttributes<HTMLElement>}
      errorMessage={errorMessage}
      errorMessageProps={pickerAria.errorMessageProps as React.HTMLAttributes<HTMLElement>}
      notice={notice}
      {...omitUndefined({ className })}
      {...includeIf(label, {
        labelProps: pickerAria.labelProps as React.HTMLAttributes<HTMLElement>,
      })}
      {...includeIf(notice, { noticeId })}
      isDisabled={resolvedState.isDisabled}
      isRequired={resolvedState.isRequired}
      layout={layout}
      fieldSize={fieldSize}
      isFloatingRaised={
        layout === "floating" ? isFocused || state.value !== null || pickerState.isOpen : true
      }
      isFloatingFocused={layout === "floating" ? isFocused || pickerState.isOpen : false}
      isInvalid={pickerState.isInvalid}
    >
      <div
        {...mergeProps(pickerAria.groupProps, focusWithinProps)}
        ref={groupRef}
        className={segmentedPickerGroupCss}
        aria-describedby={describedBy}
        aria-disabled={resolvedState.isDisabled ? dataStateTrue : undefined}
        aria-invalid={pickerState.isInvalid ? dataStateTrue : undefined}
        aria-readonly={resolvedState.isReadOnly ? dataStateTrue : undefined}
        aria-required={resolvedState.isRequired ? dataStateTrue : undefined}
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
        onChange={() => {}}
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
            onSelectToday={onSelectToday}
            {...omitUndefined({ onSelectNextWeek })}
            {...omitUndefined({ onSelectNow })}
            {...omitUndefined({ onSelectTomorrow })}
            {...omitUndefined({ timeSelectorProps })}
          />
        </Popover>
      ) : null}
    </FieldShell>
  )
}
