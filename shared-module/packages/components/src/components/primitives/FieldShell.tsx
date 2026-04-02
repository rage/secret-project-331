"use client"

import { cx } from "@emotion/css"
import React from "react"

import {
  controlSlotCss,
  descriptionCss,
  errorCss,
  fieldRootCss,
  floatingControlSlotCss,
  messagesCss,
  noticeCss,
  requiredMarkCss,
  stackedLabelCss,
} from "./fieldShellStyles"
import { fieldControlCss, type FieldSize, resolveFieldLabelCss } from "./fieldStyles"

type ControlProps = React.HTMLAttributes<HTMLDivElement> & {
  [key: `data-${string}`]: string | undefined
}

type FieldShellProps = React.PropsWithChildren<{
  className?: string
  controlClassName?: string
  controlProps?: ControlProps
  label?: React.ReactNode
  labelProps?: React.HTMLAttributes<HTMLElement> | React.LabelHTMLAttributes<HTMLLabelElement>
  inputId?: string
  description?: React.ReactNode
  descriptionId?: string
  descriptionProps?: React.HTMLAttributes<HTMLElement>
  errorMessage?: React.ReactNode
  errorMessageId?: string
  errorMessageProps?: React.HTMLAttributes<HTMLElement>
  notice?: React.ReactNode
  noticeId?: string
  isDisabled?: boolean
  isRequired?: boolean
  layout?: "floating" | "stacked"
  /** When layout is floating: label is compact (floated) vs resting inline. */
  isFloatingRaised?: boolean
  /** When layout is floating: control is focused (label accent). */
  isFloatingFocused?: boolean
  isInvalid?: boolean
  fieldSize?: FieldSize
}>

export function FieldShell({
  children,
  className,
  controlClassName,
  controlProps,
  label,
  labelProps,
  inputId,
  description,
  descriptionId,
  descriptionProps,
  errorMessage,
  errorMessageId,
  errorMessageProps,
  notice,
  noticeId,
  isDisabled = false,
  isRequired = false,
  layout = "stacked",
  isFloatingRaised = false,
  isFloatingFocused = false,
  isInvalid = false,
  fieldSize = "md",
}: FieldShellProps) {
  const controlSlotClassName = cx(
    controlSlotCss,
    layout === "floating" ? floatingControlSlotCss : undefined,
    layout === "floating" ? fieldControlCss : undefined,
    controlClassName,
    controlProps?.className,
  )

  const renderStackedLabel = () => {
    if (!label) {
      return null
    }

    if (labelProps && "htmlFor" in labelProps && typeof labelProps.htmlFor === "string") {
      return (
        <label {...labelProps} className={cx(stackedLabelCss, labelProps.className)}>
          {label}
          {isRequired ? <span className={requiredMarkCss}>*</span> : null}
        </label>
      )
    }

    if (labelProps) {
      return (
        <span {...labelProps} className={cx(stackedLabelCss, labelProps.className)}>
          {label}
          {isRequired ? <span className={requiredMarkCss}>*</span> : null}
        </span>
      )
    }

    return (
      <label className={stackedLabelCss} htmlFor={inputId}>
        {label}
        {isRequired ? <span className={requiredMarkCss}>*</span> : null}
      </label>
    )
  }

  const renderFloatingLabel = () => {
    if (!label) {
      return null
    }

    const labelClassName = cx(resolveFieldLabelCss(fieldSize), labelProps?.className)

    if (labelProps && "htmlFor" in labelProps && typeof labelProps.htmlFor === "string") {
      return (
        <label {...labelProps} className={labelClassName}>
          {label}
          {isRequired ? <span className={requiredMarkCss}>*</span> : null}
        </label>
      )
    }

    if (labelProps) {
      return (
        <span {...labelProps} className={labelClassName}>
          {label}
          {isRequired ? <span className={requiredMarkCss}>*</span> : null}
        </span>
      )
    }

    return (
      <label className={labelClassName} htmlFor={inputId}>
        {label}
        {isRequired ? <span className={requiredMarkCss}>*</span> : null}
      </label>
    )
  }

  return (
    <div className={cx(fieldRootCss, className)}>
      {layout === "stacked" ? renderStackedLabel() : null}

      <div
        {...controlProps}
        className={controlSlotClassName}
        data-field-control={layout === "floating" ? "true" : undefined}
        data-floated={layout === "floating" ? (isFloatingRaised ? "true" : "false") : undefined}
        data-focused={layout === "floating" ? (isFloatingFocused ? "true" : "false") : undefined}
        data-invalid={layout === "floating" ? (isInvalid ? "true" : "false") : undefined}
        data-disabled={layout === "floating" ? (isDisabled ? "true" : "false") : undefined}
      >
        {layout === "floating" ? renderFloatingLabel() : null}

        {children}
      </div>

      {description || notice || errorMessage ? (
        <div className={messagesCss}>
          {description ? (
            <div
              {...descriptionProps}
              className={cx(descriptionCss, descriptionProps?.className)}
              id={descriptionId ?? descriptionProps?.id}
            >
              {description}
            </div>
          ) : null}
          {notice ? (
            <div className={noticeCss} id={noticeId}>
              {notice}
            </div>
          ) : null}
          {errorMessage ? (
            <div
              {...errorMessageProps}
              className={cx(errorCss, errorMessageProps?.className)}
              id={errorMessageId ?? errorMessageProps?.id}
              role={errorMessageProps?.role ?? "alert"}
            >
              {errorMessage}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
