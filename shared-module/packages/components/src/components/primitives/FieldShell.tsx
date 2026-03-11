"use client"

import { cx } from "@emotion/css"
import React from "react"

import {
  controlSlotCss,
  descriptionCss,
  errorCss,
  fieldRootCss,
  floatingControlSlotCss,
  floatingLabelCss,
  floatingLabelDisabledCss,
  floatingLabelRaisedCss,
  messagesCss,
  noticeCss,
  requiredMarkCss,
  stackedLabelCss,
} from "./fieldShellStyles"

type ControlProps = React.HTMLAttributes<HTMLDivElement> & {
  [key: `data-${string}`]: string | undefined
}

type FieldShellProps = React.PropsWithChildren<{
  className?: string
  controlClassName?: string
  controlProps?: ControlProps
  label?: React.ReactNode
  labelProps?: React.HTMLAttributes<HTMLElement>
  inputId?: string
  description?: React.ReactNode
  descriptionId?: string
  errorMessage?: React.ReactNode
  errorMessageId?: string
  notice?: React.ReactNode
  noticeId?: string
  isDisabled?: boolean
  isRequired?: boolean
  layout?: "floating" | "stacked"
  isFloatingRaised?: boolean
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
  errorMessage,
  errorMessageId,
  notice,
  noticeId,
  isDisabled = false,
  isRequired = false,
  layout = "stacked",
  isFloatingRaised = false,
}: FieldShellProps) {
  const controlSlotClassName = cx(
    controlSlotCss,
    layout === "floating" ? floatingControlSlotCss : undefined,
    controlClassName,
    controlProps?.className,
  )

  const renderStackedLabel = () => {
    if (!label) {
      return null
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

    if (labelProps) {
      return (
        <span
          {...labelProps}
          className={cx(
            floatingLabelCss,
            isFloatingRaised ? floatingLabelRaisedCss : undefined,
            isDisabled ? floatingLabelDisabledCss : undefined,
            labelProps.className,
          )}
        >
          {label}
          {isRequired ? <span className={requiredMarkCss}>*</span> : null}
        </span>
      )
    }

    return (
      <label
        className={cx(
          floatingLabelCss,
          isFloatingRaised ? floatingLabelRaisedCss : undefined,
          isDisabled ? floatingLabelDisabledCss : undefined,
        )}
        htmlFor={inputId}
      >
        {label}
        {isRequired ? <span className={requiredMarkCss}>*</span> : null}
      </label>
    )
  }

  return (
    <div className={cx(fieldRootCss, className)}>
      {layout === "stacked" ? renderStackedLabel() : null}

      <div {...controlProps} className={controlSlotClassName}>
        {layout === "floating" ? renderFloatingLabel() : null}

        {children}
      </div>

      {description || notice || errorMessage ? (
        <div className={messagesCss}>
          {description ? (
            <div className={descriptionCss} id={descriptionId}>
              {description}
            </div>
          ) : null}
          {notice ? (
            <div className={noticeCss} id={noticeId}>
              {notice}
            </div>
          ) : null}
          {errorMessage ? (
            <div className={errorCss} id={errorMessageId} role="alert">
              {errorMessage}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
