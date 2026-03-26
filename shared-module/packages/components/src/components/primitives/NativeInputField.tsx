"use client"

import { cx } from "@emotion/css"
import React, { useEffect, useId, useState } from "react"

import { resolveFieldDescribedBy, resolveFieldState, toInputValue } from "../../lib/utils/field"

import { FieldShell } from "./FieldShell"
import {
  type FieldSize,
  inlineAffixCss,
  inputResetCss,
  inputWithFloatingLabelCss,
  resolveControlSurfaceCss,
} from "./fieldStyles"

// eslint-disable-next-line i18next/no-literal-string
const dataAttrTrue = "true"

export type NativeInputFieldProps = React.ComponentPropsWithoutRef<"input"> & {
  label: React.ReactNode
  description?: React.ReactNode
  errorMessage?: React.ReactNode
  notice?: React.ReactNode
  fieldSize?: FieldSize
  isDisabled?: boolean
  isReadOnly?: boolean
  isRequired?: boolean
  isInvalid?: boolean
  iconStart?: React.ReactNode
  iconEnd?: React.ReactNode
  layout?: "floating" | "stacked"
}

export const NativeInputField = React.forwardRef<HTMLInputElement, NativeInputFieldProps>(
  function NativeInputField(props, forwardedRef) {
    const {
      id,
      label,
      description,
      errorMessage,
      notice,
      fieldSize = "md",
      isDisabled,
      isReadOnly,
      isRequired,
      isInvalid,
      iconStart,
      iconEnd,
      layout = "stacked",
      className,
      disabled,
      readOnly,
      required,
      value,
      defaultValue,
      onChange,
      onFocus,
      onBlur,
      placeholder,
      "aria-describedby": ariaDescribedBy,
      "aria-invalid": ariaInvalid,
      ...rest
    } = props

    const generatedInputId = useId()
    const inputId = id ?? generatedInputId
    const descriptionId = useId()
    const noticeId = useId()
    const errorMessageId = useId()

    const state = resolveFieldState({
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

    const describedBy = resolveFieldDescribedBy({
      ariaDescribedBy,
      descriptionId,
      noticeId,
      errorMessageId,
      hasDescription: Boolean(description),
      hasNotice: Boolean(notice),
      hasErrorMessage: Boolean(errorMessage),
    })

    const [isFocused, setIsFocused] = useState(false)
    const [hasValue, setHasValue] = useState(toInputValue(value ?? defaultValue).length > 0)

    useEffect(() => {
      if (value !== undefined) {
        setHasValue(toInputValue(value).length > 0)
      }
    }, [value])

    return (
      <FieldShell
        className={className}
        controlClassName={cx(resolveControlSurfaceCss(fieldSize, layout === "floating"))}
        controlProps={{
          "data-has-icon-start": iconStart ? dataAttrTrue : undefined,
          "data-has-icon-end": iconEnd ? dataAttrTrue : undefined,
        }}
        label={label}
        inputId={inputId}
        description={description}
        descriptionId={description ? descriptionId : undefined}
        errorMessage={errorMessage}
        errorMessageId={errorMessage ? errorMessageId : undefined}
        notice={notice}
        noticeId={notice ? noticeId : undefined}
        isDisabled={state.isDisabled}
        isRequired={state.isRequired}
        layout={layout}
        fieldSize={fieldSize}
        isFloatingRaised={layout === "floating" ? isFocused || hasValue : true}
        isFloatingFocused={layout === "floating" ? isFocused : false}
        isInvalid={state.isInvalid}
      >
        {iconStart ? <span className={inlineAffixCss}>{iconStart}</span> : null}
        <input
          {...rest}
          id={inputId}
          ref={forwardedRef}
          value={value}
          defaultValue={defaultValue}
          className={cx(
            inputResetCss,
            layout === "floating" ? inputWithFloatingLabelCss : undefined,
          )}
          disabled={state.isDisabled}
          readOnly={state.isReadOnly}
          required={state.isRequired}
          aria-invalid={state.isInvalid ? "true" : undefined}
          aria-describedby={describedBy}
          data-invalid={state.isInvalid ? "true" : "false"}
          placeholder={layout === "floating" ? (placeholder ?? " ") : placeholder}
          onFocus={(event) => {
            setIsFocused(true)
            onFocus?.(event)
          }}
          onBlur={(event) => {
            setIsFocused(false)
            onBlur?.(event)
          }}
          onChange={(event) => {
            setHasValue(event.currentTarget.value.length > 0)
            onChange?.(event)
          }}
        />
        {iconEnd ? <span className={inlineAffixCss}>{iconEnd}</span> : null}
      </FieldShell>
    )
  },
)
