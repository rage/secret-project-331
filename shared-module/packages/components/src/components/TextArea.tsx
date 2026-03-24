"use client"

import { cx } from "@emotion/css"
import React, { useEffect, useId, useState } from "react"
import { mergeProps, useObjectRef, useTextField } from "react-aria"
import type { AriaTextFieldProps } from "react-aria"

import { joinAriaDescribedBy } from "../lib/utils/aria"
import { resolveFieldState } from "../lib/utils/field"

import { FieldShell } from "./primitives/FieldShell"
import {
  fieldControlCss,
  fieldRootCss,
  type FieldSize,
  resolveControlSurfaceCss,
  resolveFieldLabelCss,
  resolveMessageCss,
  resolveTextareaCss,
  textareaIconSlotEndStyles,
  textareaIconSlotStartStyles,
  textAreaPlainControlCss,
  textAreaPlainTextareaCss,
  textareaResetCss,
} from "./primitives/fieldStyles"

export type TextAreaProps = React.ComponentPropsWithoutRef<"textarea"> & {
  /** Visible floating label – required for accessibility. */
  label: React.ReactNode
  /** Help text shown below the field when there is no error. */
  description?: React.ReactNode
  /** Error message; also sets the field to invalid when provided. */
  errorMessage?: React.ReactNode
  /** Optional non-error notice rendered in the stacked/plain layout. */
  notice?: React.ReactNode
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
  /** Compatibility layout switch used by EditableComponentTextArea. */
  appearance?: "field" | "plain"
  validationBehavior?: AriaTextFieldProps["validationBehavior"]
  validate?: AriaTextFieldProps["validate"]
  /** When true the textarea grows to fit its content. */
  autoResize?: boolean
  /** Caps the maximum height during auto-resize (in pixels). */
  autoResizeMaxHeightPx?: number
  /** Called after the height changes due to auto-resize. */
  onAutoResized?: () => void
}

// eslint-disable-next-line i18next/no-literal-string
const stackedLayout = "stacked" as const

/** Returns true when the current textarea value is non-empty. */
function isFilled(value: unknown): boolean {
  return typeof value === "string" ? value.length > 0 : false
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
      notice,
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
      appearance = "field",
      validationBehavior,
      validate,
      id,
      value,
      defaultValue,
      autoComplete,
      maxLength,
      minLength,
      className,
      placeholder,
      autoResize = false,
      autoResizeMaxHeightPx,
      onAutoResized,
      "aria-describedby": ariaDescribedByProp,
      "aria-invalid": ariaInvalid,
      ...domProps
    } = props

    const generatedInputId = useId()
    const inputId = id ?? generatedInputId
    const descriptionId = useId()
    const noticeId = useId()
    const errorMessageId = useId()

    const textareaRef = useObjectRef(forwardedRef)
    const [isFocused, setIsFocused] = useState(false)
    const [isContentFilled, setIsContentFilled] = useState(() =>
      isFilled(value) ? true : isFilled(defaultValue),
    )

    const ariaProps = {
      label,
      description,
      errorMessage,
      id: inputId,
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

    useEffect(() => {
      if (isFilled(value)) {
        setIsContentFilled(true)
        return
      }
      if (typeof value === "string") {
        setIsContentFilled(false)
        return
      }
      if (textareaRef.current) {
        setIsContentFilled(textareaRef.current.value.length > 0)
      } else {
        setIsContentFilled(isFilled(defaultValue))
      }
    }, [value, defaultValue, textareaRef])

    // Auto-resize on mount and when the controlled value changes.
    useEffect(() => {
      if (!autoResize || !textareaRef.current) {
        return
      }
      const changed = applyAutoResize(textareaRef.current, autoResizeMaxHeightPx)
      if (changed) {
        onAutoResized?.()
      }
    }, [value, autoResize, autoResizeMaxHeightPx, onAutoResized, textareaRef])

    const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      if (typeof value !== "string") {
        setIsContentFilled(e.target.value.length > 0)
      }
      if (autoResize && textareaRef.current) {
        const changed = applyAutoResize(textareaRef.current, autoResizeMaxHeightPx)
        if (changed) {
          onAutoResized?.()
        }
      }
      onChange?.(e)
    }

    const handleFocus = (e: React.FocusEvent<HTMLTextAreaElement>) => {
      setIsFocused(true)
      onFocus?.(e)
    }

    const handleBlur = (e: React.FocusEvent<HTMLTextAreaElement>) => {
      setIsFocused(false)
      onBlur?.(e)
    }

    const mergedTextareaProps = mergeProps(inputProps, domProps, {
      onChange: handleChange,
      onFocus: handleFocus,
      onBlur: handleBlur,
      placeholder: " ",
    })

    const resolvedErrorMessage =
      errorMessage ??
      (hookIsInvalid && validationErrors.length > 0 ? validationErrors.join(" ") : null)

    const resolvedAriaDescribedBy = joinAriaDescribedBy(
      ariaDescribedByProp,
      mergedTextareaProps["aria-describedby"],
    )
    const plainTextareaProps = mergeProps(inputProps, domProps, {
      onChange: handleChange,
      onFocus: handleFocus,
      onBlur: handleBlur,
      placeholder,
    })

    const plainState = resolveFieldState({
      disabled,
      readOnly,
      required,
      isDisabled,
      isReadOnly,
      isRequired,
      isInvalid,
      ariaInvalid,
      errorMessage,
    })

    const plainResolvedAriaDescribedBy = joinAriaDescribedBy(
      ariaDescribedByProp,
      typeof plainTextareaProps["aria-describedby"] === "string"
        ? plainTextareaProps["aria-describedby"]
        : undefined,
    )
    const plainDescribedBy = joinAriaDescribedBy(
      plainResolvedAriaDescribedBy,
      description ? descriptionId : undefined,
      resolvedErrorMessage ? errorMessageId : undefined,
      notice ? noticeId : undefined,
    )

    const isFloated = isFocused || isContentFilled

    if (appearance === "plain") {
      return (
        <FieldShell
          className={className}
          controlClassName={cx(resolveControlSurfaceCss(fieldSize), textAreaPlainControlCss)}
          label={label}
          inputId={inputId}
          description={description}
          descriptionId={description ? descriptionId : undefined}
          errorMessage={resolvedErrorMessage}
          errorMessageId={resolvedErrorMessage ? errorMessageId : undefined}
          notice={notice}
          noticeId={notice ? noticeId : undefined}
          isDisabled={plainState.isDisabled}
          isRequired={plainState.isRequired}
          layout={stackedLayout}
        >
          <textarea
            {...plainTextareaProps}
            ref={textareaRef}
            className={cx(textareaResetCss, textAreaPlainTextareaCss)}
            aria-describedby={plainDescribedBy}
          />
        </FieldShell>
      )
    }

    return (
      <div className={cx(fieldRootCss, className)}>
        <div
          className={fieldControlCss}
          data-has-icon-start={iconStart ? "true" : undefined}
          data-has-icon-end={iconEnd ? "true" : undefined}
          data-focused={isFocused ? "true" : "false"}
          data-filled={isContentFilled ? "true" : "false"}
          data-floated={isFloated ? "true" : "false"}
          data-invalid={hookIsInvalid ? "true" : "false"}
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
