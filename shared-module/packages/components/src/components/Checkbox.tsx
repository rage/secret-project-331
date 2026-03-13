"use client"

import { cx } from "@emotion/css"
import { useToggleState } from "@react-stately/toggle"
import React, { useEffect, useId } from "react"
import { mergeProps, useCheckbox, useFocusRing, useObjectRef } from "react-aria"

import { resolveFieldDescribedBy, resolveFieldState } from "../lib/utils/field"

import { FieldShell } from "./primitives/FieldShell"
import {
  checkableContentCss,
  checkableInputCss,
  checkableLabelCss,
  checkableRootCss,
  checkableRowCss,
  checkboxMarkCss,
  choiceMarkCss,
  choiceMarkVisibleCss,
  indeterminateMarkCss,
  resolveCheckableSizeCss,
  resolveChoiceIndicatorCss,
} from "./primitives/checkableStyles"
import type { FieldSize } from "./primitives/fieldStyles"

export type CheckboxProps = React.ComponentPropsWithoutRef<"input"> & {
  label: React.ReactNode
  description?: React.ReactNode
  errorMessage?: React.ReactNode
  fieldSize?: FieldSize
  isDisabled?: boolean
  isReadOnly?: boolean
  isRequired?: boolean
  isInvalid?: boolean
  isIndeterminate?: boolean
}

// eslint-disable-next-line i18next/no-literal-string
const stackedLayout = "stacked" as const

export const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
  function Checkbox(props, forwardedRef) {
    const {
      id,
      label,
      description,
      errorMessage,
      fieldSize = "md",
      isDisabled,
      isReadOnly,
      isRequired,
      isInvalid,
      isIndeterminate = false,
      className,
      checked,
      defaultChecked,
      disabled,
      readOnly,
      required,
      onChange,
      onKeyDown,
      onKeyUp,
      onFocus,
      onBlur,
      name,
      value,
      "aria-describedby": ariaDescribedBy,
      "aria-invalid": ariaInvalid,
      ...rest
    } = props

    const generatedInputId = useId()
    const inputId = id ?? generatedInputId
    const descriptionId = useId()
    const errorMessageId = useId()
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
    const describedBy = resolveFieldDescribedBy({
      ariaDescribedBy,
      descriptionId,
      errorMessageId,
      hasDescription: Boolean(description),
      hasErrorMessage: Boolean(errorMessage),
    })

    const inputRef = useObjectRef(forwardedRef)
    const toggleState = useToggleState({
      isDisabled: resolvedState.isDisabled,
      isReadOnly: resolvedState.isReadOnly,
      isSelected: checked,
      defaultSelected: defaultChecked,
    })
    const inputValue =
      value == null ? undefined : Array.isArray(value) ? value.join(",") : String(value)

    const { inputProps, isSelected, labelProps } = useCheckbox(
      {
        id: inputId,
        name,
        value: inputValue,
        isDisabled: resolvedState.isDisabled,
        isReadOnly: resolvedState.isReadOnly,
        isRequired: resolvedState.isRequired,
        isInvalid: resolvedState.isInvalid,
        isIndeterminate,
        "aria-describedby": describedBy,
      },
      toggleState,
      inputRef,
    )

    const { focusProps, isFocusVisible } = useFocusRing()

    useEffect(() => {
      if (inputRef.current) {
        inputRef.current.indeterminate = isIndeterminate
      }
    }, [inputRef, isIndeterminate])

    const mergedInputProps = mergeProps(inputProps, focusProps, {
      ...rest,
      onBlur,
      onChange,
      onFocus,
      onKeyDown,
      onKeyUp,
    })

    const showCheck = isSelected && !isIndeterminate

    return (
      <FieldShell
        className={cx(checkableRootCss, className)}
        description={description}
        descriptionId={description ? descriptionId : undefined}
        errorMessage={errorMessage}
        errorMessageId={errorMessage ? errorMessageId : undefined}
        layout={stackedLayout}
      >
        <label
          {...labelProps}
          className={cx(checkableRowCss, resolveCheckableSizeCss(fieldSize))}
          data-disabled={resolvedState.isDisabled ? "true" : "false"}
        >
          <input {...mergedInputProps} ref={inputRef} className={checkableInputCss} />
          <span
            className={resolveChoiceIndicatorCss(fieldSize, "checkbox")}
            aria-hidden="true"
            data-disabled={resolvedState.isDisabled ? "true" : "false"}
            data-focus-visible={isFocusVisible ? "true" : "false"}
            data-indeterminate={isIndeterminate ? "true" : "false"}
            data-invalid={resolvedState.isInvalid ? "true" : "false"}
            data-selected={isSelected ? "true" : "false"}
          >
            {showCheck ? (
              <span className={cx(choiceMarkCss, choiceMarkVisibleCss, checkboxMarkCss)} />
            ) : null}
            {isIndeterminate ? (
              <span className={cx(choiceMarkCss, choiceMarkVisibleCss, indeterminateMarkCss)} />
            ) : null}
          </span>
          <span className={checkableContentCss}>
            <span className={checkableLabelCss}>{label}</span>
          </span>
        </label>
      </FieldShell>
    )
  },
)
