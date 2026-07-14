"use client"

import { cx } from "@emotion/css"
import React, { useRef } from "react"
import { mergeProps, useTextField } from "react-aria"
import type { AriaTextFieldProps } from "react-aria"
import type { FieldValues, Path } from "react-hook-form"

import { type RhfFieldProps, useRhfField } from "../lib/types/rhfField"
import { joinAriaDescribedBy } from "../lib/utils/aria"
import { composeRefs } from "../lib/utils/compositeField"
import { resolveFloatingPlaceholder, resolveRenderedErrorMessage } from "../lib/utils/floatingField"
import {
  fieldControlCss,
  fieldRootCss,
  type FieldSize,
  iconSlotEndCss,
  iconSlotStartCss,
  resolveFieldLabelCss,
  resolveInputCss,
  resolveMessageCss,
} from "./primitives/fieldStyles"
import { useFloatingFieldState } from "./primitives/useFloatingFieldState"

/**
 * Text input with floating label, description, and error display.
 * Uses react-hook-form; pass `name` and `control`.
 *
 * @example
 * // Basic usage
 * <TextField name="email" control={control} label="Email" type="email" />
 *
 * @example
 * // Usage with validation rules
 * <TextField name="email" control={control} label="Email" type="email" rules={{ required: t("required-field") }} />
 */
export type TextFieldProps<T extends FieldValues, N extends Path<T> = Path<T>> = RhfFieldProps<
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
  id?: string
  type?: React.HTMLInputTypeAttribute
  autoComplete?: string
  min?: number | string
  max?: number | string
  maxLength?: number
  minLength?: number
  pattern?: string
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"]
  placeholder?: string
  className?: string
  step?: string
}

export function TextField<T extends FieldValues, N extends Path<T> = Path<T>>(
  props: TextFieldProps<T, N>,
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
    id,
    type = "text",
    autoComplete,
    maxLength,
    minLength,
    pattern,
    inputMode,
    placeholder,
    className,
    min,
    max,
    step,
  } = props

  const { field, resolvedError, isInvalid } = useRhfField({ name, control, rules, errorMessage })
  const inputRef = useRef<HTMLInputElement>(null)
  const stringValue = field.value === null || field.value === undefined ? "" : String(field.value)

  const floatingState = useFloatingFieldState({
    defaultValue: undefined,
    elementRef: inputRef,
    value: stringValue,
  })

  const ariaProps: AriaTextFieldProps = {
    label,
    description,
    errorMessage: resolvedError,
    name: field.name,
    type,
    value: stringValue,
    isInvalid,
    ...(id !== undefined ? { id } : {}),
    ...(autoComplete !== undefined ? { autoComplete } : {}),
    ...(maxLength !== undefined ? { maxLength } : {}),
    ...(minLength !== undefined ? { minLength } : {}),
    ...(pattern !== undefined ? { pattern } : {}),
    ...(inputMode !== undefined ? { inputMode } : {}),
    ...(placeholder !== undefined ? { placeholder } : {}),
    ...(isDisabled !== undefined ? { isDisabled } : {}),
    ...(isReadOnly !== undefined ? { isReadOnly } : {}),
    ...(isRequired !== undefined ? { isRequired } : {}),
  }

  const {
    labelProps,
    inputProps,
    descriptionProps,
    errorMessageProps,
    isInvalid: hookIsInvalid,
    validationErrors,
  } = useTextField(ariaProps, inputRef)

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    field.onChange(e.target.value)
  }

  const handleFocus = () => {
    floatingState.setIsFocused(true)
  }

  const handleBlur = () => {
    floatingState.setIsFocused(false)
    field.onBlur()
  }

  const mergedInputProps = mergeProps(inputProps, {
    onChange: handleChange,
    onFocus: handleFocus,
    onBlur: handleBlur,
    placeholder: resolveFloatingPlaceholder(),
    min,
    max,
    step,
  })

  const resolvedRenderedError = resolveRenderedErrorMessage(
    resolvedError,
    hookIsInvalid,
    validationErrors,
  )

  const resolvedAriaDescribedBy = joinAriaDescribedBy(
    undefined,
    mergedInputProps["aria-describedby"],
  )

  return (
    <div className={cx(fieldRootCss, className)}>
      <div
        className={fieldControlCss}
        data-field-control="true"
        data-has-icon-start={iconStart ? "true" : undefined}
        data-has-icon-end={iconEnd ? "true" : undefined}
        data-focused={floatingState.isFocused ? "true" : "false"}
        data-filled={floatingState.hasValue ? "true" : "false"}
        data-floated={floatingState.isFloated ? "true" : "false"}
        data-invalid={hookIsInvalid ? "true" : "false"}
      >
        <input
          {...mergedInputProps}
          ref={composeRefs(inputRef, field.ref)}
          className={resolveInputCss(fieldSize)}
          aria-describedby={resolvedAriaDescribedBy}
        />
        <label {...labelProps} className={resolveFieldLabelCss(fieldSize)}>
          {label}
        </label>
        {iconStart ? (
          <span className={iconSlotStartCss} aria-hidden="true">
            {iconStart}
          </span>
        ) : null}
        {iconEnd ? (
          <span className={iconSlotEndCss} aria-hidden="true">
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
