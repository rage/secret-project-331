"use client"

import { cx } from "@emotion/css"
import React from "react"
import { mergeProps, useObjectRef, useTextField } from "react-aria"
import type { AriaTextFieldProps } from "react-aria"

import { joinAriaDescribedBy } from "../lib/utils/aria"

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

export type TextFieldProps = React.ComponentPropsWithoutRef<"input"> & {
  /** Visible floating label – required for accessibility. */
  label: React.ReactNode
  /** Help text shown below the field when there is no error. */
  description?: React.ReactNode
  /** Error message; also sets the field to invalid when provided. */
  errorMessage?: React.ReactNode
  /** Visual size of the field control. Distinct from the native `size` (character-width) attribute. */
  fieldSize?: FieldSize
  /** Decorative icon rendered at the leading edge of the input. */
  iconStart?: React.ReactNode
  /** Decorative icon rendered at the trailing edge of the input. */
  iconEnd?: React.ReactNode
  /** React Aria alias for the native `disabled` prop. */
  isDisabled?: boolean
  /** React Aria alias for the native `readOnly` prop. */
  isReadOnly?: boolean
  /** React Aria alias for the native `required` prop. */
  isRequired?: boolean
  /** Marks the field invalid regardless of validation state. */
  isInvalid?: boolean
  validationBehavior?: AriaTextFieldProps["validationBehavior"]
  validate?: AriaTextFieldProps["validate"]
}

export const TextField = React.forwardRef<HTMLInputElement, TextFieldProps>(
  function TextField(props, forwardedRef) {
    const {
      label,
      description,
      errorMessage,
      fieldSize = "md",
      iconStart,
      iconEnd,
      onChange,
      onFocus,
      onBlur,
      disabled,
      readOnly,
      required,
      isDisabled,
      isReadOnly,
      isRequired,
      isInvalid,
      validationBehavior,
      validate,
      id,
      value,
      defaultValue,
      name,
      type = "text",
      autoComplete,
      maxLength,
      minLength,
      pattern,
      inputMode,
      className,
      "aria-describedby": ariaDescribedByProp,
      ...domProps
    } = props

    const inputRef = useObjectRef(forwardedRef)

    const ariaProps: AriaTextFieldProps = {
      label,
      description,
      errorMessage,
      id,
      name,
      type,
      value: value as string | undefined,
      defaultValue: defaultValue as string | undefined,
      autoComplete,
      maxLength,
      minLength,
      pattern,
      inputMode,
      validate,
      validationBehavior,
      isDisabled: isDisabled ?? disabled,
      isReadOnly: isReadOnly ?? readOnly,
      isRequired: isRequired ?? required,
      isInvalid: isInvalid ?? !!errorMessage,
    }

    const {
      labelProps,
      inputProps,
      descriptionProps,
      errorMessageProps,
      isInvalid: hookIsInvalid,
      validationErrors,
    } = useTextField(ariaProps, inputRef)

    const mergedInputProps = mergeProps(inputProps, domProps, {
      onChange,
      onFocus,
      onBlur,
      // Single space keeps :placeholder-shown false only when the field has content,
      // which drives the floating-label CSS transition.
      placeholder: " ",
    })

    const resolvedErrorMessage =
      errorMessage ??
      (hookIsInvalid && validationErrors.length > 0 ? validationErrors.join(" ") : null)

    // Combine the hook-generated aria-describedby (description/error IDs) with
    // any external aria-describedby the caller may have passed.
    const resolvedAriaDescribedBy = joinAriaDescribedBy(
      ariaDescribedByProp,
      mergedInputProps["aria-describedby"],
    )

    return (
      <div className={cx(fieldRootCss, className)}>
        <div
          className={fieldControlCss}
          data-has-icon-start={iconStart ? "true" : undefined}
          data-has-icon-end={iconEnd ? "true" : undefined}
        >
          <input
            {...mergedInputProps}
            ref={inputRef}
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

        {resolvedErrorMessage ? (
          <p {...errorMessageProps} role="alert" className={resolveMessageCss(fieldSize, true)}>
            {resolvedErrorMessage}
          </p>
        ) : description ? (
          <p {...descriptionProps} className={resolveMessageCss(fieldSize, false)}>
            {description}
          </p>
        ) : null}
      </div>
    )
  },
)

TextField.displayName = "TextField"
