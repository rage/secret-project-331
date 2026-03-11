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

type FieldShellProps = React.PropsWithChildren<{
  className?: string
  controlClassName?: string
  label?: React.ReactNode
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
  label,
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
  return (
    <div className={cx(fieldRootCss, className)}>
      {layout === "stacked" && label ? (
        <label className={stackedLabelCss} htmlFor={inputId}>
          {label}
          {isRequired ? <span className={requiredMarkCss}>*</span> : null}
        </label>
      ) : null}

      <div
        className={cx(
          controlSlotCss,
          layout === "floating" ? floatingControlSlotCss : undefined,
          controlClassName,
        )}
      >
        {layout === "floating" && label ? (
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
        ) : null}

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
