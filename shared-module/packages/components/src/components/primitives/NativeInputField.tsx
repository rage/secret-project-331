"use client"

import { css, cx } from "@emotion/css"
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

const floatingLabelOffsetDefaultCss = css`
  --field-floating-label-offset: 16px;
`

const floatingLabelOffsetWithAffixCss = css`
  --field-floating-label-offset: 42px;
`

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
        controlClassName={cx(
          resolveControlSurfaceCss(fieldSize, layout === "floating"),
          iconStart ? floatingLabelOffsetWithAffixCss : floatingLabelOffsetDefaultCss,
        )}
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
        isFloatingRaised={layout === "floating" ? isFocused || hasValue : true}
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
