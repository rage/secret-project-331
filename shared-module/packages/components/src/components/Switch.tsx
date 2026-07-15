"use client"

import { cx } from "@emotion/css"
import { useToggleState } from "@react-stately/toggle"
import React, { useId, useRef } from "react"
import { mergeProps, useFocusRing, useSwitch } from "react-aria"
import type { FieldValues, Path } from "react-hook-form"

import { type RhfFieldProps, useRhfField } from "../lib/types/rhfField"
import { composeRefs } from "../lib/utils/compositeField"
import { resolveFieldDescribedBy } from "../lib/utils/field"
import { includeIf, omitUndefined } from "../lib/utils/nullability"
import {
  checkableContentCss,
  checkableInputCss,
  checkableLabelCss,
  checkableRootCss,
  checkableRowCss,
  resolveCheckableSizeCss,
  switchRowCss,
  switchThumbCss,
  switchTrackCss,
} from "./primitives/checkableStyles"
import { FieldShell } from "./primitives/FieldShell"
import type { FieldSize } from "./primitives/fieldStyles"

// oxlint-disable-next-line i18next/no-literal-string
const stackedLayout = "stacked" as const
// oxlint-disable-next-line i18next/no-literal-string
const dataStateTrue = "true"

/**
 * Accessible switch (toggle) with label and optional description or error text.
 * Uses react-hook-form; pass `name` and `control`. Field value is boolean.
 *
 * @example
 * <Switch name="enabled" control={control} label="Enable notifications" />
 */
export type SwitchProps<T extends FieldValues, N extends Path<T> = Path<T>> = RhfFieldProps<
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
  id?: string
  switchValue?: string | number | readonly string[]
  onKeyDown?: React.KeyboardEventHandler<HTMLInputElement>
  onKeyUp?: React.KeyboardEventHandler<HTMLInputElement>
  "aria-label"?: string
  className?: string
}

export function Switch<T extends FieldValues, N extends Path<T> = Path<T>>(
  props: SwitchProps<T, N>,
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
    className,
    switchValue,
    onKeyDown,
    onKeyUp,
    "aria-label": ariaLabel,
  } = props

  const { field, resolvedError, isInvalid } = useRhfField({ name, control, rules, errorMessage })
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
    switchValue === undefined
      ? undefined
      : Array.isArray(switchValue)
        ? switchValue.join(",")
        : String(switchValue)

  const {
    inputProps,
    isDisabled: isSwitchDisabled,
    isPressed,
    isSelected,
    labelProps,
  } = useSwitch(
    {
      children: label,
      id: inputId,
      name: field.name,
      isDisabled,
      isReadOnly,
      ...omitUndefined({
        value: inputValue,
        "aria-label": ariaLabel,
        "aria-describedby": describedBy,
      }),
    },
    toggleState,
    inputRef,
  )

  const { focusProps, isFocusVisible } = useFocusRing()
  const mergedInputProps = mergeProps(inputProps, focusProps, {
    onKeyDown,
    onKeyUp,
    onBlur: (e: React.FocusEvent<HTMLInputElement>) => {
      inputProps.onBlur?.(e)
      field.onBlur()
    },
    "aria-invalid": isInvalid ? dataStateTrue : undefined,
    required: isRequired,
    type: "checkbox" as const,
  })

  return (
    <FieldShell
      className={cx(checkableRootCss, className)}
      description={description}
      {...includeIf(description, { descriptionId })}
      errorMessage={resolvedError}
      {...includeIf(resolvedError, { errorMessageId })}
      layout={stackedLayout}
    >
      <label
        {...labelProps}
        className={cx(checkableRowCss, switchRowCss, resolveCheckableSizeCss(fieldSize))}
        data-disabled={isSwitchDisabled ? "true" : "false"}
      >
        <input
          {...mergedInputProps}
          ref={composeRefs(inputRef, field.ref)}
          className={checkableInputCss}
        />
        <span
          className={switchTrackCss}
          aria-hidden="true"
          data-disabled={isSwitchDisabled ? "true" : "false"}
          data-focus-visible={isFocusVisible ? "true" : "false"}
          data-invalid={isInvalid ? "true" : "false"}
          data-pressed={isPressed ? "true" : "false"}
          data-selected={isSelected ? "true" : "false"}
        >
          <span className={switchThumbCss} data-selected={isSelected ? "true" : "false"} />
        </span>
        <span className={checkableContentCss}>
          <span className={checkableLabelCss}>{label}</span>
        </span>
      </label>
    </FieldShell>
  )
}
