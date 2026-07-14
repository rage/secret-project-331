"use client"

import { cx } from "@emotion/css"
import { useToggleState } from "@react-stately/toggle"
import React, { useEffect, useId, useRef } from "react"
import { mergeProps, useCheckbox, useFocusRing } from "react-aria"
import type { FieldValues, Path } from "react-hook-form"

import { type RhfFieldProps, useRhfField } from "../lib/types/rhfField"
import { composeRefs } from "../lib/utils/compositeField"
import { resolveFieldDescribedBy } from "../lib/utils/field"

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

// oxlint-disable-next-line i18next/no-literal-string
const stackedLayout = "stacked" as const

/**
 * Accessible checkbox with label and optional description or error text.
 * Uses react-hook-form; pass `name` and `control`. Field value is boolean.
 *
 * @example
 * <Checkbox name="terms" control={control} label="I agree" />
 */
export type CheckboxProps<T extends FieldValues, N extends Path<T> = Path<T>> = RhfFieldProps<
  T,
  N
> & {
  label: React.ReactNode
  description?: React.ReactNode
  errorMessage?: React.ReactNode
  fieldSize?: FieldSize
  isDisabled?: boolean
  isReadOnly?: boolean
  isRequired?: boolean
  isIndeterminate?: boolean
  id?: string
  /** Optional `value` attribute on the native checkbox (not the form field value). */
  checkboxValue?: string | number | readonly string[]
  onKeyDown?: React.KeyboardEventHandler<HTMLInputElement>
  onKeyUp?: React.KeyboardEventHandler<HTMLInputElement>
  "aria-label"?: string
  className?: string
}

export function Checkbox<T extends FieldValues, N extends Path<T> = Path<T>>(
  props: CheckboxProps<T, N>,
) {
  const {
    name,
    control,
    rules,
    id,
    label,
    description,
    errorMessage,
    fieldSize = "md",
    isDisabled = false,
    isReadOnly = false,
    isRequired = false,
    isIndeterminate = false,
    className,
    checkboxValue,
    onKeyDown,
    onKeyUp,
    "aria-label": ariaLabel,
  } = props

  const { field, resolvedError, isInvalid } = useRhfField({
    name,
    control,
    ...(rules !== undefined ? { rules } : {}),
    errorMessage,
  })
  const selected = Boolean(field.value)

  const generatedInputId = useId()
  const inputId = id ?? generatedInputId
  const descriptionId = useId()
  const errorMessageId = useId()
  const describedBy = resolveFieldDescribedBy({
    descriptionId,
    errorMessageId,
    hasDescription: Boolean(description),
    hasErrorMessage: Boolean(resolvedError),
  })

  const inputRef = useRef<HTMLInputElement>(null)
  const toggleState = useToggleState({
    isDisabled,
    isReadOnly,
    isSelected: selected,
    onChange: (next) => {
      field.onChange(next)
    },
  })

  const inputValue =
    checkboxValue === undefined
      ? undefined
      : Array.isArray(checkboxValue)
        ? checkboxValue.join(",")
        : String(checkboxValue)

  const { inputProps, isSelected, labelProps } = useCheckbox(
    {
      children: label,
      id: inputId,
      name: field.name,
      isDisabled,
      isReadOnly,
      isRequired,
      isInvalid,
      isIndeterminate,
      ...(inputValue !== undefined ? { value: inputValue } : {}),
      ...(ariaLabel !== undefined ? { "aria-label": ariaLabel } : {}),
      ...(describedBy !== undefined ? { "aria-describedby": describedBy } : {}),
    },
    toggleState,
    inputRef,
  )

  const { focusProps, isFocusVisible } = useFocusRing()

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.indeterminate = isIndeterminate
    }
  }, [isIndeterminate])

  const mergedInputProps = mergeProps(inputProps, focusProps, {
    onKeyDown,
    onKeyUp,
    onBlur: (e: React.FocusEvent<HTMLInputElement>) => {
      inputProps.onBlur?.(e)
      field.onBlur()
    },
  })

  return (
    <FieldShell
      className={cx(checkableRootCss, className)}
      description={description}
      {...(description ? { descriptionId } : {})}
      errorMessage={resolvedError}
      {...(resolvedError ? { errorMessageId } : {})}
      layout={stackedLayout}
    >
      <label
        {...labelProps}
        className={cx(checkableRowCss, resolveCheckableSizeCss(fieldSize))}
        data-disabled={isDisabled ? "true" : "false"}
      >
        <input
          {...mergedInputProps}
          ref={composeRefs(inputRef, field.ref)}
          className={checkableInputCss}
          type="checkbox"
        />
        <span
          className={resolveChoiceIndicatorCss(fieldSize, "checkbox")}
          aria-hidden="true"
          data-disabled={isDisabled ? "true" : "false"}
          data-focus-visible={isFocusVisible ? "true" : "false"}
          data-indeterminate={isIndeterminate ? "true" : "false"}
          data-invalid={isInvalid ? "true" : "false"}
          data-selected={isSelected ? "true" : "false"}
        >
          <span
            className={cx(
              choiceMarkCss,
              checkboxMarkCss,
              isSelected && !isIndeterminate && choiceMarkVisibleCss,
            )}
          />
          <span
            className={cx(
              choiceMarkCss,
              indeterminateMarkCss,
              isIndeterminate && choiceMarkVisibleCss,
            )}
          />
        </span>
        <span className={checkableContentCss}>
          <span className={checkableLabelCss}>{label}</span>
        </span>
      </label>
    </FieldShell>
  )
}
