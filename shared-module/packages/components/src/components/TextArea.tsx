"use client"

import { cx } from "@emotion/css"
import React, { useEffect, useId } from "react"
import { mergeProps, useObjectRef, useTextField } from "react-aria"
import type { AriaTextFieldProps } from "react-aria"

import type { TextareaDomProps } from "../lib/types/domProps"
import { joinAriaDescribedBy } from "../lib/utils/aria"
import { resolveFieldState } from "../lib/utils/field"
import { resolveFloatingPlaceholder, resolveRenderedErrorMessage } from "../lib/utils/floatingField"

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
import { useFloatingFieldState } from "./primitives/useFloatingFieldState"

export type TextAreaProps = {
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
  autoResize?: boolean
  autoResizeMaxHeightPx?: number
  onAutoResized?: (heightPx: number) => void
  id?: string
  value?: string
  defaultValue?: string
  name?: string
  disabled?: boolean
  readOnly?: boolean
  required?: boolean
  autoComplete?: string
  maxLength?: number
  minLength?: number
  placeholder?: string
  onChange?: React.ChangeEventHandler<HTMLTextAreaElement>
  onFocus?: React.FocusEventHandler<HTMLTextAreaElement>
  onBlur?: React.FocusEventHandler<HTMLTextAreaElement>
  "aria-describedby"?: string
  "aria-label"?: string
  "aria-invalid"?: React.AriaAttributes["aria-invalid"]
  className?: string
  domProps?: TextareaDomProps
}

export type InternalTextAreaProps = TextAreaProps & {
  appearance?: "field" | "plain"
  notice?: React.ReactNode
}

// eslint-disable-next-line i18next/no-literal-string
const stackedLayout = "stacked" as const

/** Adjusts the element height to fit its scrollable content. Returns the new height when it changed. */
function applyAutoResize(el: HTMLTextAreaElement, maxHeightPx: number | undefined): number | null {
  const prevHeight = el.style.height
  // eslint-disable-next-line i18next/no-literal-string
  el.style.height = "auto"
  const scrollH = el.scrollHeight
  const clampedH = maxHeightPx ? Math.min(scrollH, maxHeightPx) : scrollH
  // eslint-disable-next-line i18next/no-literal-string
  el.style.height = `${clampedH}px`
  // eslint-disable-next-line i18next/no-literal-string
  el.style.overflowY = maxHeightPx && scrollH > maxHeightPx ? "auto" : "hidden"
  return prevHeight !== el.style.height ? clampedH : null
}

export const TextAreaBase = React.forwardRef<HTMLTextAreaElement, InternalTextAreaProps>(
  function TextAreaBase(props, forwardedRef) {
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
      "aria-label": ariaLabel,
      name,
      domProps,
    } = props

    const generatedInputId = useId()
    const inputId = id ?? generatedInputId
    const noticeId = useId()

    const textareaRef = useObjectRef(forwardedRef)
    const floatingState = useFloatingFieldState({
      defaultValue,
      elementRef: textareaRef,
      value,
    })

    const resolvedState = resolveFieldState({
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

    const ariaProps = {
      label,
      description,
      errorMessage,
      id: inputId,
      value,
      defaultValue,
      autoComplete,
      name,
      maxLength,
      minLength,
      validate,
      validationBehavior,
      isDisabled: resolvedState.isDisabled,
      isReadOnly: resolvedState.isReadOnly,
      isRequired: resolvedState.isRequired,
      isInvalid: resolvedState.isInvalid,
      "aria-label": ariaLabel,
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
    useEffect(() => {
      if (!autoResize || !textareaRef.current) {
        return
      }
      const nextHeight = applyAutoResize(textareaRef.current, autoResizeMaxHeightPx)
      if (nextHeight != null) {
        onAutoResized?.(nextHeight)
      }
    }, [value, autoResize, autoResizeMaxHeightPx, onAutoResized, textareaRef])

    const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      if (value === undefined) {
        floatingState.setHasValue(e.target.value.length > 0)
      }
      if (autoResize && textareaRef.current) {
        const nextHeight = applyAutoResize(textareaRef.current, autoResizeMaxHeightPx)
        if (nextHeight != null) {
          onAutoResized?.(nextHeight)
        }
      }
      onChange?.(e)
    }

    const handleFocus = (e: React.FocusEvent<HTMLTextAreaElement>) => {
      floatingState.setIsFocused(true)
      onFocus?.(e)
    }

    const handleBlur = (e: React.FocusEvent<HTMLTextAreaElement>) => {
      floatingState.setIsFocused(false)
      onBlur?.(e)
    }

    const mergedTextareaProps = mergeProps(inputProps, domProps ?? {}, {
      onChange: handleChange,
      onFocus: handleFocus,
      onBlur: handleBlur,
      placeholder: resolveFloatingPlaceholder(),
    })

    const resolvedErrorMessage = resolveRenderedErrorMessage(
      errorMessage,
      hookIsInvalid,
      validationErrors,
    )

    const resolvedAriaDescribedBy = joinAriaDescribedBy(
      ariaDescribedByProp,
      mergedTextareaProps["aria-describedby"],
    )
    const resolvedAriaInvalid = ariaInvalid ?? mergedTextareaProps["aria-invalid"]
    const plainTextareaProps = mergeProps(inputProps, domProps ?? {}, {
      onChange: handleChange,
      onFocus: handleFocus,
      onBlur: handleBlur,
      placeholder,
    })

    const plainResolvedAriaDescribedBy = joinAriaDescribedBy(
      ariaDescribedByProp,
      typeof plainTextareaProps["aria-describedby"] === "string"
        ? plainTextareaProps["aria-describedby"]
        : undefined,
      notice ? noticeId : undefined,
    )
    const plainAriaInvalid = ariaInvalid ?? plainTextareaProps["aria-invalid"]

    if (appearance === "plain") {
      return (
        <FieldShell
          className={className}
          controlClassName={cx(resolveControlSurfaceCss(fieldSize), textAreaPlainControlCss)}
          label={label}
          labelProps={labelProps as React.HTMLAttributes<HTMLElement>}
          description={description}
          descriptionProps={descriptionProps as React.HTMLAttributes<HTMLElement>}
          errorMessage={resolvedErrorMessage}
          errorMessageProps={errorMessageProps as React.HTMLAttributes<HTMLElement>}
          notice={notice}
          noticeId={notice ? noticeId : undefined}
          isDisabled={resolvedState.isDisabled}
          isRequired={resolvedState.isRequired}
          layout={stackedLayout}
        >
          <textarea
            {...plainTextareaProps}
            ref={textareaRef}
            className={cx(textareaResetCss, textAreaPlainTextareaCss)}
            aria-describedby={plainResolvedAriaDescribedBy}
            aria-invalid={plainAriaInvalid}
          />
        </FieldShell>
      )
    }

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
            ref={textareaRef}
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

export const TextArea = React.forwardRef<HTMLTextAreaElement, TextAreaProps>(
  function TextArea(props, forwardedRef) {
    // eslint-disable-next-line i18next/no-literal-string -- internal appearance variant
    return <TextAreaBase {...props} ref={forwardedRef} appearance="field" />
  },
)

TextAreaBase.displayName = "TextAreaBase"
TextArea.displayName = "TextArea"
