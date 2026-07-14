"use client"

import { cx } from "@emotion/css"
import React, { useEffect, useId, useRef } from "react"
import { mergeProps, useTextField } from "react-aria"
import type { FieldValues, Path } from "react-hook-form"

import { type RhfFieldProps, useRhfField } from "../lib/types/rhfField"
import { joinAriaDescribedBy } from "../lib/utils/aria"
import { composeRefs } from "../lib/utils/compositeField"
import { resolveFloatingPlaceholder, resolveRenderedErrorMessage } from "../lib/utils/floatingField"

import {
  fieldControlCss,
  fieldRootCss,
  type FieldSize,
  resolveFieldLabelCss,
  resolveMessageCss,
  resolveTextareaCss,
  textareaIconSlotEndStyles,
  textareaIconSlotStartStyles,
} from "./primitives/fieldStyles"
import { useFloatingFieldState } from "./primitives/useFloatingFieldState"

// oxlint-disable-next-line i18next/no-literal-string
const textareaInputType = "textarea" as const

/** Adjusts the element height to fit its scrollable content. Returns the new height when it changed. */
function applyAutoResize(el: HTMLTextAreaElement, maxHeightPx: number | undefined): number | null {
  const prevHeight = el.style.height
  // oxlint-disable-next-line i18next/no-literal-string
  el.style.height = "auto"
  const scrollH = el.scrollHeight
  const clampedH = maxHeightPx ? Math.min(scrollH, maxHeightPx) : scrollH
  // oxlint-disable-next-line i18next/no-literal-string
  el.style.height = `${clampedH}px`
  // oxlint-disable-next-line i18next/no-literal-string
  el.style.overflowY = maxHeightPx && scrollH > maxHeightPx ? "auto" : "hidden"
  return prevHeight !== el.style.height ? clampedH : null
}

/**
 * Multiline text input with floating label, description, and error display.
 * Uses react-hook-form; pass `name` and `control`.
 *
 * @example
 * <TextArea name="bio" control={control} label="Bio" rows={4} />
 */
export type TextAreaProps<T extends FieldValues, N extends Path<T> = Path<T>> = RhfFieldProps<
  T,
  N
> & {
  label: React.ReactNode
  description?: React.ReactNode
  errorMessage?: React.ReactNode
  fieldSize?: FieldSize
  iconStart?: React.ReactNode
  iconEnd?: React.ReactNode
  isDisabled?: boolean
  isReadOnly?: boolean
  isRequired?: boolean
  autoResize?: boolean
  autoResizeMaxHeightPx?: number
  onAutoResized?: (heightPx: number) => void
  id?: string
  autoComplete?: string
  maxLength?: number
  minLength?: number
  placeholder?: string
  rows?: number
  className?: string
}

export function TextArea<T extends FieldValues, N extends Path<T> = Path<T>>(
  props: TextAreaProps<T, N>,
) {
  const {
    name,
    control,
    rules,
    label,
    description,
    errorMessage,
    fieldSize = "md",
    iconStart,
    iconEnd,
    isDisabled,
    isReadOnly,
    isRequired,
    autoResize = false,
    autoResizeMaxHeightPx,
    onAutoResized,
    id,
    autoComplete,
    maxLength,
    minLength,
    rows,
    className,
  } = props

  const { field, resolvedError, isInvalid } = useRhfField({ name, control, rules, errorMessage })
  const generatedInputId = useId()
  const inputId = id ?? generatedInputId
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const stringValue = field.value === null || field.value === undefined ? "" : String(field.value)

  const floatingState = useFloatingFieldState({
    defaultValue: undefined,
    elementRef: textareaRef,
    value: stringValue,
  })

  const ariaProps = {
    label,
    description,
    errorMessage: resolvedError,
    id: inputId,
    value: stringValue,
    autoComplete,
    name: field.name,
    maxLength,
    minLength,
    isDisabled,
    isReadOnly,
    isRequired,
    isInvalid,
    inputElementType: textareaInputType,
  }

  const {
    labelProps,
    inputProps,
    descriptionProps,
    errorMessageProps,
    isInvalid: hookIsInvalid,
    validationErrors,
  } = useTextField(ariaProps, textareaRef)

  useEffect(() => {
    if (!autoResize || !textareaRef.current) {
      return
    }
    const nextHeight = applyAutoResize(textareaRef.current, autoResizeMaxHeightPx)
    if (nextHeight !== null) {
      onAutoResized?.(nextHeight)
    }
  }, [stringValue, autoResize, autoResizeMaxHeightPx, onAutoResized])

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    field.onChange(e.target.value)
    if (autoResize && textareaRef.current) {
      const nextHeight = applyAutoResize(textareaRef.current, autoResizeMaxHeightPx)
      if (nextHeight !== null) {
        onAutoResized?.(nextHeight)
      }
    }
  }

  const handleFocus = () => {
    floatingState.setIsFocused(true)
  }

  const handleBlur = () => {
    floatingState.setIsFocused(false)
    field.onBlur()
  }

  const mergedTextareaProps = mergeProps(inputProps, {
    onChange: handleChange,
    onFocus: handleFocus,
    onBlur: handleBlur,
    placeholder: resolveFloatingPlaceholder(),
    rows,
  })

  const resolvedRenderedError = resolveRenderedErrorMessage(
    resolvedError,
    hookIsInvalid,
    validationErrors,
  )

  const resolvedAriaDescribedBy = joinAriaDescribedBy(
    undefined,
    mergedTextareaProps["aria-describedby"],
  )
  const resolvedAriaInvalid = mergedTextareaProps["aria-invalid"]

  return (
    <div className={cx(fieldRootCss, className)}>
      <div
        className={fieldControlCss}
        data-field-control="true"
        data-multiline="true"
        data-has-icon-start={iconStart ? "true" : undefined}
        data-has-icon-end={iconEnd ? "true" : undefined}
        data-focused={floatingState.isFocused ? "true" : "false"}
        data-filled={floatingState.hasValue ? "true" : "false"}
        data-floated={floatingState.isFloated ? "true" : "false"}
        data-invalid={hookIsInvalid ? "true" : "false"}
      >
        <textarea
          {...mergedTextareaProps}
          ref={composeRefs(textareaRef, field.ref)}
          className={resolveTextareaCss(fieldSize)}
          aria-describedby={resolvedAriaDescribedBy}
          aria-invalid={resolvedAriaInvalid}
        />
        <label {...labelProps} className={resolveFieldLabelCss(fieldSize)}>
          {label}
        </label>
        {iconStart ? (
          <span className={textareaIconSlotStartStyles[fieldSize]} aria-hidden="true">
            {iconStart}
          </span>
        ) : null}
        {iconEnd ? (
          <span className={textareaIconSlotEndStyles[fieldSize]} aria-hidden="true">
            {iconEnd}
          </span>
        ) : null}
      </div>

      {resolvedRenderedError ? (
        <p {...errorMessageProps} role="alert" className={resolveMessageCss(fieldSize, true)}>
          {resolvedRenderedError}
        </p>
      ) : description ? (
        <p {...descriptionProps} className={resolveMessageCss(fieldSize, false)}>
          {description}
        </p>
      ) : null}
    </div>
  )
}
