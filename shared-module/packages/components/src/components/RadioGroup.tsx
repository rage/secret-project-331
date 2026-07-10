"use client"

import { css, cx } from "@emotion/css"
import { useRadioGroupState } from "@react-stately/radio"
import type { RadioGroupState } from "@react-stately/radio"
import React, { useImperativeHandle, useRef } from "react"
import { mergeProps, useRadioGroup } from "react-aria"
import type { FieldValues, Path } from "react-hook-form"

import { type RhfFieldProps, useRhfField } from "../lib/types/rhfField"

import {
  descriptionCss,
  errorCss,
  fieldRootCss,
  messagesCss,
  stackedLabelCss,
} from "./primitives/fieldShellStyles"
import type { FieldSize } from "./primitives/fieldStyles"

type RadioGroupContextValue = {
  fieldSize: FieldSize
  state: RadioGroupState
}

export const RadioGroupContext = React.createContext<RadioGroupContextValue | null>(null)

const fieldsetCss = css`
  margin: 0;
  padding: 0;
  border: 0;
`

const radioListCss = css`
  display: grid;
  gap: var(--space-2);
`

const radioListHorizontalCss = css`
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-4);
`

// oxlint-disable-next-line i18next/no-literal-string
const radioInputSelector = 'input[type="radio"]'

/**
 * Group of radio options with legend and validation messaging.
 * Uses react-hook-form; pass `name` and `control`. Field value is the selected option value string.
 *
 * @example
 * <RadioGroup name="plan" control={control} label="Plan">
 *   <Radio value="a" label="A" />
 * </RadioGroup>
 */
export type RadioGroupProps<T extends FieldValues, N extends Path<T> = Path<T>> = RhfFieldProps<
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
  orientation?: "vertical" | "horizontal"
  "aria-label"?: string
  className?: string
  children?: React.ReactNode
}

export function RadioGroup<T extends FieldValues, N extends Path<T> = Path<T>>(
  props: RadioGroupProps<T, N>,
) {
  const {
    name,
    control,
    rules,
    label,
    description,
    errorMessage,
    fieldSize = "md",
    isDisabled = false,
    isReadOnly = false,
    isRequired = false,
    orientation = "vertical",
    className,
    children,
    "aria-label": ariaLabel,
  } = props

  const { field, resolvedError, isInvalid } = useRhfField({ name, control, rules, errorMessage })
  const fieldsetRef = useRef<HTMLFieldSetElement>(null)

  // RHF focus-on-error: `field.ref` targets the group; redirect to the first radio for keyboard users.
  useImperativeHandle(field.ref, () => ({
    focus() {
      fieldsetRef.current?.querySelector<HTMLInputElement>(radioInputSelector)?.focus()
    },
  }))

  const state = useRadioGroupState({
    value: field.value == null ? undefined : String(field.value),
    onChange: (v) => {
      field.onChange(v)
    },
    name: field.name,
    isDisabled,
    isReadOnly,
    isRequired,
    isInvalid,
  })

  const {
    radioGroupProps,
    labelProps,
    descriptionProps,
    errorMessageProps,
    isInvalid: hookIsInvalid,
    validationErrors,
  } = useRadioGroup(
    {
      label,
      description,
      errorMessage: resolvedError,
      name: field.name,
      "aria-describedby": undefined,
      "aria-label": ariaLabel,
      orientation,
      isDisabled,
      isReadOnly,
      isRequired,
      isInvalid,
    },
    state,
  )

  const resolvedRenderedError =
    resolvedError ??
    (hookIsInvalid && validationErrors.length > 0 ? validationErrors.join(" ") : null)

  const fieldsetProps = mergeProps(radioGroupProps, {
    onBlur: (e: React.FocusEvent<HTMLFieldSetElement>) => {
      if (fieldsetRef.current?.contains(e.relatedTarget as Node)) {
        return
      }
      field.onBlur()
    },
  })

  return (
    <fieldset
      {...fieldsetProps}
      ref={fieldsetRef}
      className={cx(fieldRootCss, fieldsetCss, className)}
      disabled={state.isDisabled}
    >
      <legend {...labelProps} className={stackedLabelCss}>
        {label}
      </legend>

      <RadioGroupContext.Provider value={{ fieldSize, state }}>
        <div className={orientation === "horizontal" ? radioListHorizontalCss : radioListCss}>
          {children}
        </div>
      </RadioGroupContext.Provider>

      {description || resolvedRenderedError ? (
        <div className={messagesCss}>
          {description ? (
            <div {...descriptionProps} className={descriptionCss}>
              {description}
            </div>
          ) : null}
          {resolvedRenderedError ? (
            <div {...errorMessageProps} className={errorCss} role="alert">
              {resolvedRenderedError}
            </div>
          ) : null}
        </div>
      ) : null}
    </fieldset>
  )
}
