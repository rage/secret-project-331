"use client"

import { cx } from "@emotion/css"
import type { DateFieldState } from "@react-stately/datepicker"
import type React from "react"
import type { DateFieldAria } from "react-aria"

import { composeRefs } from "../../../lib/utils/compositeField"
import type { resolveFieldState } from "../../../lib/utils/field"
import { joinAriaDescribedBy } from "../../../lib/utils/field"
import { FieldShell } from "../FieldShell"
import {
  type FieldSize,
  inlineAffixCss,
  resolveControlSurfaceCss,
  resolveSegmentedFloatingShellCss,
} from "../fieldStyles"

import { DateSegment } from "./DateSegment"
import { dataStateFalse, dataStateTrue } from "./segmentedDateInputFieldConstants"
import {
  segmentedFieldDisabledCss,
  segmentedFieldReadOnlyCss,
  segmentedFieldShellCss,
  segmentedFieldShellRestEmptyCss,
  segmentedSegmentsRowCss,
  segmentedSegmentsRowRestHiddenCss,
} from "./segmentedDateInputFieldStyles"
import {
  emitSyntheticBlur,
  emitSyntheticFocus,
  shouldHideRestSegmentPlaceholders,
} from "./segmentedDateInputFieldUtils"

export interface NonPickerSegmentedFieldProps {
  aria: DateFieldAria
  className?: string
  description?: React.ReactNode
  errorMessage?: React.ReactNode
  externalOnBlur?: React.FocusEventHandler<HTMLElement>
  externalOnFocus?: React.FocusEventHandler<HTMLElement>
  fieldRef: React.RefObject<HTMLDivElement | null>
  fieldSize: FieldSize
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
  resolvedState: ReturnType<typeof resolveFieldState>
  setIsFocused: React.Dispatch<React.SetStateAction<boolean>>
  state: DateFieldState
}

/** Segmented date/time field without an overlay calendar (time-only mode). */
export function NonPickerSegmentedField({
  aria,
  className,
  description,
  errorMessage,
  externalOnBlur,
  externalOnFocus,
  fieldRef,
  fieldSize,
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
}: NonPickerSegmentedFieldProps) {
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
      descriptionProps={aria.descriptionProps as React.HTMLAttributes<HTMLElement>}
      errorMessage={errorMessage}
      errorMessageProps={aria.errorMessageProps as React.HTMLAttributes<HTMLElement>}
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
          const isLeavingField = !fieldRef.current?.contains(event.relatedTarget as Node | null)

          if (isLeavingField) {
            setIsFocused(false)
            emitSyntheticBlur(
              hiddenInputRef.current,
              externalOnBlur as React.FocusEventHandler<HTMLInputElement> | undefined,
            )
          }

          aria.fieldProps.onBlur?.(event)
        }}
        onFocus={(event) => {
          if (!isFocused) {
            emitSyntheticFocus(
              hiddenInputRef.current,
              externalOnFocus as React.FocusEventHandler<HTMLInputElement> | undefined,
            )
          }

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
        ref={composeRefs(hiddenInputRef, inputRef)}
        type="hidden"
        aria-describedby={describedBy}
        value={hiddenInputValue}
        onChange={() => {}}
      />
      {iconEnd ? <span className={inlineAffixCss}>{iconEnd}</span> : null}
    </FieldShell>
  )
}
