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
  resolveFieldLabelCss,
  resolveMessageCss,
  resolveTextareaCss,
  textareaIconSlotEndStyles,
  textareaIconSlotStartStyles,
} from "./primitives/fieldStyles"

export type TextAreaProps = React.ComponentPropsWithoutRef<"textarea"> & {
  /** Visible floating label – required for accessibility. */
  label: React.ReactNode
  /** Help text shown below the field when there is no error. */
  description?: React.ReactNode
  /** Error message; also sets the field to invalid when provided. */
  errorMessage?: React.ReactNode
  /** Visual size of the field control: "sm", "md" (default), or "lg". */
  fieldSize?: FieldSize
  /** Decorative icon rendered at the leading edge. Anchored to the label resting position. */
  iconStart?: React.ReactNode
  /** Decorative icon rendered at the trailing edge. Anchored to the label resting position. */
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
  /** When true the textarea grows to fit its content. */
  autoResize?: boolean
  /** Caps the maximum height during auto-resize (in pixels). */
  autoResizeMaxHeightPx?: number
  /** Called after the height changes due to auto-resize. */
  onAutoResized?: () => void
}

/** Adjusts the element height to fit its scrollable content. Returns true if height changed. */
function applyAutoResize(el: HTMLTextAreaElement, maxHeightPx: number | undefined): boolean {
  const prevHeight = el.style.height
  // eslint-disable-next-line i18next/no-literal-string
  el.style.height = "auto"
  const scrollH = el.scrollHeight
  const clampedH = maxHeightPx ? Math.min(scrollH, maxHeightPx) : scrollH
  // eslint-disable-next-line i18next/no-literal-string
  el.style.height = `${clampedH}px`
  // eslint-disable-next-line i18next/no-literal-string
  el.style.overflowY = maxHeightPx && scrollH > maxHeightPx ? "auto" : "hidden"
  return prevHeight !== el.style.height
}

export const TextArea = React.forwardRef<HTMLTextAreaElement, TextAreaProps>(
  function TextArea(props, forwardedRef) {
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
      autoComplete,
      maxLength,
      minLength,
      className,
      autoResize = false,
      autoResizeMaxHeightPx,
      onAutoResized,
      "aria-describedby": ariaDescribedByProp,
      ...domProps
    } = props

    const textareaRef = useObjectRef(forwardedRef)

    const ariaProps = {
      label,
      description,
      errorMessage,
      id,
      // value/defaultValue must be string for useTextField
      value: value as string | undefined,
      defaultValue: defaultValue as string | undefined,
      autoComplete,
      maxLength,
      minLength,
      validate,
      validationBehavior,
      isDisabled: isDisabled ?? disabled,
      isReadOnly: isReadOnly ?? readOnly,
      isRequired: isRequired ?? required,
      isInvalid: isInvalid ?? !!errorMessage,
      // eslint-disable-next-line i18next/no-literal-string
      inputElementType: "textarea" as const,
    }

    const {
      labelProps,
      inputProps,
      descriptionProps,
      errorMessageProps,
      isInvalid: hookIsInvalid,
      validationErrors,
    } = useTextField(ariaProps, textareaRef)

    // Auto-resize on mount and when the controlled value changes.
    React.useEffect(() => {
      if (!autoResize || !textareaRef.current) {
        return
      }
      const changed = applyAutoResize(textareaRef.current, autoResizeMaxHeightPx)
      if (changed) {
        onAutoResized?.()
      }
    }, [value, autoResize, autoResizeMaxHeightPx, onAutoResized, textareaRef])

    const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      if (autoResize && textareaRef.current) {
        const changed = applyAutoResize(textareaRef.current, autoResizeMaxHeightPx)
        if (changed) {
          onAutoResized?.()
        }
      }
      onChange?.(e)
    }

    const mergedTextareaProps = mergeProps(inputProps, domProps, {
      onChange: handleChange,
      onFocus,
      onBlur,
      placeholder: " ",
    })

    const resolvedErrorMessage =
      errorMessage ??
      (hookIsInvalid && validationErrors.length > 0 ? validationErrors.join(" ") : null)

    const resolvedAriaDescribedBy = joinAriaDescribedBy(
      ariaDescribedByProp,
      mergedTextareaProps["aria-describedby"],
    )

    return (
      <div className={cx(fieldRootCss, className)}>
        <div
          className={fieldControlCss}
          data-has-icon-start={iconStart ? "true" : undefined}
          data-has-icon-end={iconEnd ? "true" : undefined}
        >
          <textarea
            {...mergedTextareaProps}
            ref={textareaRef}
            className={resolveTextareaCss(fieldSize)}
            aria-describedby={resolvedAriaDescribedBy}
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

TextArea.displayName = "TextArea"
