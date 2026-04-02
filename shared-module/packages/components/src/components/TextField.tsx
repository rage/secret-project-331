"use client"

import { cx } from "@emotion/css"
import React from "react"
import { mergeProps, useObjectRef, useTextField } from "react-aria"
import type { AriaTextFieldProps } from "react-aria"

import type { InputDomProps } from "../lib/types/domProps"
import { joinAriaDescribedBy } from "../lib/utils/aria"
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

export type TextFieldProps = {
  label: React.ReactNode
  description?: React.ReactNode
  errorMessage?: React.ReactNode
  fieldSize?: FieldSize
  iconStart?: React.ReactNode
  iconEnd?: React.ReactNode
  isDisabled?: boolean
  isReadOnly?: boolean
  isRequired?: boolean
  isInvalid?: boolean
  validationBehavior?: AriaTextFieldProps["validationBehavior"]
  validate?: AriaTextFieldProps["validate"]
  id?: string
  name?: string
  type?: React.HTMLInputTypeAttribute
  value?: string
  defaultValue?: string
  disabled?: boolean
  readOnly?: boolean
  required?: boolean
  autoComplete?: string
  min?: number | string
  max?: number | string
  maxLength?: number
  minLength?: number
  pattern?: string
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"]
  placeholder?: string
  onChange?: React.ChangeEventHandler<HTMLInputElement>
  onFocus?: React.FocusEventHandler<HTMLInputElement>
  onBlur?: React.FocusEventHandler<HTMLInputElement>
  "aria-describedby"?: string
  "aria-label"?: string
  "aria-invalid"?: React.AriaAttributes["aria-invalid"]
  className?: string
  domProps?: InputDomProps
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
      placeholder,
      className,
      "aria-describedby": ariaDescribedByProp,
      "aria-label": ariaLabel,
      "aria-invalid": ariaInvalid,
      min,
      max,
      domProps,
    } = props

    const inputRef = useObjectRef(forwardedRef)
    const floatingState = useFloatingFieldState({
      defaultValue,
      elementRef: inputRef,
      value,
    })

    const ariaProps: AriaTextFieldProps = {
      label,
      description,
      errorMessage,
      id,
      name,
      type,
      value,
      defaultValue,
      autoComplete,
      maxLength,
      minLength,
      pattern,
      inputMode,
      placeholder,
      validate,
      validationBehavior,
      "aria-label": ariaLabel,
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

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (value === undefined) {
        floatingState.setHasValue(e.target.value.length > 0)
      }
      onChange?.(e)
    }

    const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
      floatingState.setIsFocused(true)
      onFocus?.(e)
    }

    const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
      floatingState.setIsFocused(false)
      onBlur?.(e)
    }

    const mergedInputProps = mergeProps(inputProps, domProps ?? {}, {
      onChange: handleChange,
      onFocus: handleFocus,
      onBlur: handleBlur,
      placeholder: resolveFloatingPlaceholder(),
      min,
      max,
      "aria-invalid": ariaInvalid,
    })

    const resolvedErrorMessage = resolveRenderedErrorMessage(
      errorMessage,
      hookIsInvalid,
      validationErrors,
    )

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
