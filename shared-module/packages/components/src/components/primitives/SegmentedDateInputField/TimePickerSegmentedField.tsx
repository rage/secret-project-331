"use client"

import { cx } from "@emotion/css"
import type { DateFieldState } from "@react-stately/datepicker"
import { useOverlayTriggerState } from "@react-stately/overlays"
import React, { useId, useRef } from "react"
import { mergeProps, useFocusWithin, useOverlayTrigger } from "react-aria"
import type { DateFieldAria } from "react-aria"

import { composeRefs } from "../../../lib/utils/compositeField"
import type { resolveFieldState } from "../../../lib/utils/field"
import { joinAriaDescribedBy } from "../../../lib/utils/field"
import { includeIf, omitUndefined } from "../../../lib/utils/nullability"
import { useDatePickerCalendarLabels } from "../DatePickerCalendar/datePickerCalendarLabels"
import type { DatePickerTimeSelectorProps } from "../DatePickerCalendar/datePickerCalendarTypes"
import { TimePickerDialog } from "../DatePickerCalendar/TimePickerDialog"
import { FieldShell } from "../FieldShell"
import {
  type FieldSize,
  inlineAffixCss,
  resolveControlSurfaceCss,
  resolveSegmentedFloatingShellCss,
} from "../fieldStyles"
import { Popover } from "../popover"
import { ClockIcon } from "./ClockIcon"
import { DateSegment } from "./DateSegment"
import { PickerTriggerButton } from "./PickerTriggerButton"
import { dataStateFalse, dataStateTrue } from "./segmentedDateInputFieldConstants"
import {
  segmentedFieldDisabledCss,
  segmentedFieldReadOnlyCss,
  segmentedFieldShellCss,
  segmentedPickerFieldCss,
  segmentedPickerGroupCss,
  segmentedSegmentsRowCss,
  segmentedSegmentsRowRestHiddenCss,
  timePickerPopoverCss,
} from "./segmentedDateInputFieldStyles"
import {
  createPointerOpenHandler,
  emitSyntheticBlur,
  emitSyntheticFocus,
  shouldHideRestSegmentPlaceholders,
} from "./segmentedDateInputFieldUtils"

export interface TimePickerSegmentedFieldProps {
  aria: DateFieldAria
  className?: string | undefined
  dataTestId?: string | undefined
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
  resolvedState: ReturnType<typeof resolveFieldState>
  setIsFocused: React.Dispatch<React.SetStateAction<boolean>>
  state: DateFieldState
  timeSelectorProps: DatePickerTimeSelectorProps
}

/** Segmented time field with a time selector popover. */
export function TimePickerSegmentedField({
  aria,
  className,
  dataTestId,
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
  resolvedState,
  setIsFocused,
  state,
  timeSelectorProps,
}: TimePickerSegmentedFieldProps) {
  const valueTestId = dataTestId ? `${dataTestId}-value` : undefined
  const triggerTestId = dataTestId ? `${dataTestId}-trigger` : undefined
  const labels = useDatePickerCalendarLabels()
  const triggerId = useId()
  const triggerRef = useRef<HTMLButtonElement>(null)
  const overlayState = useOverlayTriggerState({})
  const { triggerProps, overlayProps } = useOverlayTrigger(
    { type: "dialog" },
    overlayState,
    triggerRef,
  )
  const labelId = typeof aria.labelProps.id === "string" ? aria.labelProps.id : undefined
  const labelledBy = labelId ? `${triggerId} ${labelId}` : triggerId

  const describedBy = joinAriaDescribedBy(
    typeof aria.fieldProps["aria-describedby"] === "string"
      ? aria.fieldProps["aria-describedby"]
      : undefined,
    notice ? noticeId : undefined,
  )

  const isFloatingLayout = layout === "floating"
  const hideRestSegmentPlaceholders = shouldHideRestSegmentPlaceholders(
    layout,
    isFocused,
    state.value !== null,
    overlayState.isOpen,
  )

  // The popover is portaled outside the field, so focus moving into it reads as leaving the field;
  // committing blur then would mark the field touched mid-interaction.
  const isPopoverOpenRef = useRef(overlayState.isOpen)
  isPopoverOpenRef.current = overlayState.isOpen

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

  const onPointerOpen = createPointerOpenHandler({
    isOpen: overlayState.isOpen,
    isDisabled: resolvedState.isDisabled,
    isReadOnly: resolvedState.isReadOnly,
    open: overlayState.open,
  })
  // Mirrors the date pickers, whose react-aria group opens on Alt+ArrowDown.
  const onOpenShortcut = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (
      event.altKey &&
      event.key === "ArrowDown" &&
      !resolvedState.isDisabled &&
      !resolvedState.isReadOnly
    ) {
      event.preventDefault()
      overlayState.open()
    }
  }

  // A floating label sits inside the control slot, so only a stacked one needs its own handler.
  const labelProps = mergeProps(
    aria.labelProps,
    isFloatingLayout ? {} : { onClick: onPointerOpen },
  ) as React.HTMLAttributes<HTMLElement>

  return (
    <FieldShell
      controlClassName={cx(
        // Only the floating layout moves the segments shell's padding; stacked has no label
        // band inside the control, so there the surface keeps padding it.
        resolveControlSurfaceCss(fieldSize, isFloatingLayout, !isFloatingLayout),
      )}
      controlProps={{
        "data-disabled": resolvedState.isDisabled ? dataStateTrue : dataStateFalse,
        "data-invalid": state.isInvalid ? dataStateTrue : dataStateFalse,
        "data-readonly": resolvedState.isReadOnly ? dataStateTrue : dataStateFalse,
        "data-has-icon-start": iconStart ? dataStateTrue : undefined,
        onClickCapture: onPointerOpen,
      }}
      label={label}
      description={description}
      descriptionProps={aria.descriptionProps as React.HTMLAttributes<HTMLElement>}
      errorMessage={errorMessage}
      errorMessageProps={aria.errorMessageProps as React.HTMLAttributes<HTMLElement>}
      notice={notice}
      {...omitUndefined({ className })}
      {...includeIf(label, { labelProps })}
      {...includeIf(notice, { noticeId })}
      isDisabled={resolvedState.isDisabled}
      isRequired={resolvedState.isRequired}
      layout={layout}
      fieldSize={fieldSize}
      isFloatingRaised={
        layout === "floating" ? isFocused || state.value !== null || overlayState.isOpen : true
      }
      isFloatingFocused={layout === "floating" ? isFocused || overlayState.isOpen : false}
      isInvalid={state.isInvalid}
    >
      <div
        {...mergeProps(focusWithinProps, { onKeyDown: onOpenShortcut })}
        ref={groupRef}
        className={segmentedPickerGroupCss}
      >
        {iconStart ? <span className={inlineAffixCss}>{iconStart}</span> : null}
        <div className={segmentedPickerFieldCss}>
          <div
            {...aria.fieldProps}
            ref={fieldRef}
            className={cx(
              segmentedFieldShellCss,
              isFloatingLayout ? resolveSegmentedFloatingShellCss(fieldSize) : undefined,
              resolvedState.isDisabled ? segmentedFieldDisabledCss : undefined,
              resolvedState.isReadOnly ? segmentedFieldReadOnlyCss : undefined,
            )}
            data-testid={dataTestId}
            aria-disabled={resolvedState.isDisabled ? dataStateTrue : undefined}
            aria-describedby={describedBy}
            aria-invalid={state.isInvalid ? dataStateTrue : undefined}
            aria-readonly={resolvedState.isReadOnly ? dataStateTrue : undefined}
            aria-required={resolvedState.isRequired ? dataStateTrue : undefined}
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
        <PickerTriggerButton
          buttonProps={{
            ...triggerProps,
            id: triggerId,
            "aria-label": labels.time,
            "aria-labelledby": labelledBy,
            isDisabled: resolvedState.isDisabled || resolvedState.isReadOnly,
          }}
          dataTestId={triggerTestId}
          icon={<ClockIcon />}
        />
      </div>
      <input
        {...aria.inputProps}
        ref={composeRefs(hiddenInputRef, inputRef)}
        type="hidden"
        data-testid={valueTestId}
        aria-describedby={describedBy}
        value={hiddenInputValue}
        onChange={() => {}}
      />
      {overlayState.isOpen ? (
        <Popover
          className={timePickerPopoverCss}
          state={overlayState}
          triggerRef={groupRef}
          placement="bottom start"
        >
          <TimePickerDialog
            dialogProps={{ ...overlayProps, "aria-labelledby": labelledBy }}
            timeSelectorProps={timeSelectorProps}
          />
        </Popover>
      ) : null}
    </FieldShell>
  )
}
