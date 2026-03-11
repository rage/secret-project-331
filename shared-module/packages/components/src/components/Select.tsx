"use client"

import { cx } from "@emotion/css"
import React, { useId } from "react"

import { resolveFieldDescribedBy, resolveFieldState } from "../lib/utils/field"

import { FieldShell } from "./primitives/FieldShell"
import { type FieldSize, inputResetCss, resolveControlSurfaceCss } from "./primitives/fieldStyles"
import { nativeSelectCss, selectCaretCss } from "./primitives/selectStyles"

export type SelectProps = React.ComponentPropsWithoutRef<"select"> & {
  label: React.ReactNode
  description?: React.ReactNode
  errorMessage?: React.ReactNode
  fieldSize?: FieldSize
  isDisabled?: boolean
  isRequired?: boolean
  isInvalid?: boolean
}

// eslint-disable-next-line i18next/no-literal-string
const stackedLayout = "stacked" as const

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  function Select(props, forwardedRef) {
    const {
      id,
      label,
      description,
      errorMessage,
      fieldSize = "md",
      isDisabled,
      isRequired,
      isInvalid,
      className,
      disabled,
      required,
      children,
      "aria-describedby": ariaDescribedBy,
      "aria-invalid": ariaInvalid,
      ...rest
    } = props

    const generatedInputId = useId()
    const inputId = id ?? generatedInputId
    const descriptionId = useId()
    const errorMessageId = useId()
    const state = resolveFieldState({
      disabled,
      required,
      isDisabled,
      isRequired,
      isInvalid,
      ariaInvalid,
      errorMessage,
    })
    const describedBy = resolveFieldDescribedBy({
      ariaDescribedBy,
      descriptionId,
      errorMessageId,
      hasDescription: Boolean(description),
      hasErrorMessage: Boolean(errorMessage),
    })

    return (
      <FieldShell
        className={className}
        controlClassName={resolveControlSurfaceCss(fieldSize)}
        label={label}
        inputId={inputId}
        description={description}
        descriptionId={description ? descriptionId : undefined}
        errorMessage={errorMessage}
        errorMessageId={errorMessage ? errorMessageId : undefined}
        isDisabled={state.isDisabled}
        isRequired={state.isRequired}
        layout={stackedLayout}
      >
        <select
          {...rest}
          id={inputId}
          ref={forwardedRef}
          className={cx(inputResetCss, nativeSelectCss)}
          disabled={state.isDisabled}
          required={state.isRequired}
          aria-describedby={describedBy}
          aria-invalid={state.isInvalid ? "true" : undefined}
        >
          {children}
        </select>
        <span className={selectCaretCss} aria-hidden="true" />
      </FieldShell>
    )
  },
)
