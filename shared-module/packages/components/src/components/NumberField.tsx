"use client"

import { css, cx } from "@emotion/css"
import { useNumberFieldState } from "@react-stately/numberfield"
import React, { useRef } from "react"
import { mergeProps, useButton, useFocusWithin, useLocale, useNumberField } from "react-aria"
import type { AriaNumberFieldProps } from "react-aria"
import type { FieldValues, Path } from "react-hook-form"
import { useTranslation } from "react-i18next"

import { type RhfFieldProps, useRhfField } from "../lib/types/rhfField"
import { joinAriaDescribedBy } from "../lib/utils/aria"
import { composeRefs } from "../lib/utils/compositeField"
import { resolveFloatingPlaceholder, resolveRenderedErrorMessage } from "../lib/utils/floatingField"
import { omitUndefined } from "../lib/utils/nullability"
import {
  fieldControlCss,
  fieldRootCss,
  type FieldSize,
  iconSlotStartCss,
  resolveFieldLabelCss,
  resolveInputCss,
  resolveMessageCss,
} from "./primitives/fieldStyles"
import { useFloatingFieldState } from "./primitives/useFloatingFieldState"

const stepperCss = css`
  position: absolute;
  right: 0.25rem;
  top: 0.25rem;
  bottom: 0.25rem;
  display: flex;
  flex-direction: column;
  width: 1.75rem;
`

const stepperButtonCss = css`
  flex: 1 1 0;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 0;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--field-chrome);
  cursor: pointer;

  &:disabled {
    opacity: 0.35;
    cursor: not-allowed;
  }

  &[data-focus-visible="true"] {
    outline: none;
    box-shadow: 0 0 0 var(--focus-ring-width) var(--focus-ring-color);
    border-radius: 3px;
  }
`

const stepperDecrementCss = css`
  border-top: 1px solid var(--field-border);
`

const stepperChevronCss = css`
  width: 8px;
  height: 8px;
  border-right: 1.6px solid currentColor;
  border-bottom: 1.6px solid currentColor;
`

const stepperChevronUpCss = css`
  transform: rotate(-135deg);
`

const stepperChevronDownCss = css`
  transform: rotate(45deg);
`

/**
 * Numeric input with stepper buttons, floating label, description, and error display.
 * Uses react-hook-form; pass `name` and `control`. Form value is `number | null` (empty commits
 * as `null`, matching the `stringToNumberOrNull` convention used for other numeric fields).
 *
 * @example
 * <NumberField name="quantity" control={control} label="Quantity" minValue={0} step={1} />
 */
export type NumberFieldProps<T extends FieldValues, N extends Path<T> = Path<T>> = RhfFieldProps<
  T,
  N
> & {
  label: React.ReactNode
  description?: React.ReactNode
  errorMessage?: React.ReactNode
  fieldSize?: FieldSize
  iconStart?: React.ReactNode
  isDisabled?: boolean
  isReadOnly?: boolean
  isRequired?: boolean
  id?: string
  minValue?: number
  maxValue?: number
  step?: number
  /**
   * What happens to a typed value on blur. `"snap"` (the default) rounds it to the nearest `step`;
   * `"validate"` keeps it as typed, leaving range and precision to the caller's `rules`. Use
   * `"validate"` when `step` is only meant to size the stepper buttons.
   */
  commitBehavior?: "snap" | "validate"
  formatOptions?: Intl.NumberFormatOptions
  isWheelDisabled?: boolean
  placeholder?: string
  className?: string
}

export function NumberField<T extends FieldValues, N extends Path<T> = Path<T>>(
  props: NumberFieldProps<T, N>,
) {
  const {
    name,
    control,
    rules,
    label,
    description,
    errorMessage,
    fieldSize = "md",
    iconStart,
    isDisabled,
    isReadOnly,
    isRequired,
    id,
    minValue,
    maxValue,
    step,
    commitBehavior,
    formatOptions,
    isWheelDisabled,
    placeholder,
    className,
  } = props

  const { t } = useTranslation("shared-module")
  const { field, resolvedError, isInvalid } = useRhfField({ name, control, rules, errorMessage })
  const { locale } = useLocale()

  const inputRef = useRef<HTMLInputElement>(null)
  const incrementRef = useRef<HTMLButtonElement>(null)
  const decrementRef = useRef<HTMLButtonElement>(null)
  const groupRef = useRef<HTMLDivElement>(null)

  // field.value can be a numeric string for a not-yet-migrated caller (TextField's own
  // convention tolerates this too), so coerce before falling back to NaN/empty.
  const numericValue =
    typeof field.value === "number"
      ? field.value
      : typeof field.value === "string" && field.value.trim() !== ""
        ? Number(field.value)
        : Number.NaN

  const sharedProps = {
    label,
    description,
    errorMessage: resolvedError,
    isInvalid,
    value: numericValue,
    onChange: (value: number) => {
      field.onChange(Number.isNaN(value) ? null : value)
    },
    ...omitUndefined({
      minValue,
      maxValue,
      step,
      commitBehavior,
      formatOptions,
      isDisabled,
      isReadOnly,
      isRequired,
    }),
  }

  const state = useNumberFieldState({ ...sharedProps, locale })

  const floatingState = useFloatingFieldState({
    defaultValue: undefined,
    elementRef: inputRef,
    value: state.inputValue,
  })

  // react-aria's own default aria-label composition is skipped whenever these props are set,
  // so a fixed generic string would make every NumberField instance on a page indistinguishable
  // to screen readers; include the field's own label when it's plain text.
  const incrementAriaLabel =
    typeof label === "string"
      ? t("numberField.incrementFor", { label })
      : t("numberField.increment")
  const decrementAriaLabel =
    typeof label === "string"
      ? t("numberField.decrementFor", { label })
      : t("numberField.decrement")

  const ariaProps: AriaNumberFieldProps = {
    ...sharedProps,
    incrementAriaLabel,
    decrementAriaLabel,
    ...omitUndefined({ id, isWheelDisabled, placeholder }),
  }

  const {
    labelProps,
    groupProps,
    inputProps,
    incrementButtonProps,
    decrementButtonProps,
    descriptionProps,
    errorMessageProps,
    isInvalid: hookIsInvalid,
    validationErrors,
  } = useNumberField(ariaProps, state, inputRef)

  const { buttonProps: incrementProps } = useButton(incrementButtonProps, incrementRef)
  const { buttonProps: decrementProps } = useButton(decrementButtonProps, decrementRef)

  // Stepper buttons live inside the same field control as the input, so moving focus between
  // them must not read as the field losing focus (the bug fixed for segmented date/time fields
  // in #1756). useFocusWithin tracks the whole group instead of per-element blur.
  const { focusWithinProps } = useFocusWithin({
    onFocusWithin: () => {
      floatingState.setIsFocused(true)
    },
    onBlurWithin: () => {
      floatingState.setIsFocused(false)
      field.onBlur()
    },
  })

  const mergedInputProps = mergeProps(inputProps, {
    placeholder: resolveFloatingPlaceholder(),
  })

  const resolvedRenderedError = resolveRenderedErrorMessage(
    resolvedError,
    hookIsInvalid,
    validationErrors,
  )

  const resolvedAriaDescribedBy = joinAriaDescribedBy(
    undefined,
    mergedInputProps["aria-describedby"],
  )

  return (
    <div className={cx(fieldRootCss, className)}>
      <div
        {...mergeProps(groupProps, focusWithinProps)}
        ref={groupRef}
        className={fieldControlCss}
        data-field-control="true"
        data-has-icon-start={iconStart ? "true" : undefined}
        data-has-icon-end="true"
        data-focused={floatingState.isFocused ? "true" : "false"}
        data-filled={floatingState.hasValue ? "true" : "false"}
        data-floated={floatingState.isFloated ? "true" : "false"}
        data-invalid={hookIsInvalid ? "true" : "false"}
      >
        <input
          {...mergedInputProps}
          ref={composeRefs(inputRef, field.ref)}
          className={resolveInputCss(fieldSize)}
          aria-describedby={resolvedAriaDescribedBy}
        />
        <label {...labelProps} className={resolveFieldLabelCss(fieldSize)}>
          {label}
        </label>
        {iconStart ? (
          <span className={iconSlotStartCss} aria-hidden="true">
            {iconStart}
          </span>
        ) : null}
        <div className={stepperCss}>
          <button {...incrementProps} ref={incrementRef} type="button" className={stepperButtonCss}>
            <span className={cx(stepperChevronCss, stepperChevronUpCss)} aria-hidden="true" />
          </button>
          <button
            {...decrementProps}
            ref={decrementRef}
            type="button"
            className={cx(stepperButtonCss, stepperDecrementCss)}
          >
            <span className={cx(stepperChevronCss, stepperChevronDownCss)} aria-hidden="true" />
          </button>
        </div>
      </div>

      {resolvedRenderedError ? (
        <p {...errorMessageProps} role="alert" className={resolveMessageCss(fieldSize, true)}>
          {resolvedRenderedError}
        </p>
      ) : description ? (
        <p {...descriptionProps} className={resolveMessageCss(fieldSize, false)}>
          {description}
        </p>
      ) : null}
    </div>
  )
}
