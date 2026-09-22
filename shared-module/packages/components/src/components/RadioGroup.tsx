"use client"

import { css, cx } from "@emotion/css"
import { useRadioGroupState } from "@react-stately/radio"
import type { RadioGroupState } from "@react-stately/radio"
import React, { useImperativeHandle, useRef } from "react"
import { mergeProps, useRadioGroup } from "react-aria"
import type { FieldValues, Path } from "react-hook-form"

import { type RhfFieldProps, useRhfField } from "../lib/types/rhfField"
import { omitUndefined } from "../lib/utils/nullability"
import {
  descriptionCss,
  errorCss,
  fieldRootCss,
  messagesCss,
  stackedLabelCss,
} from "./primitives/fieldShellStyles"
import type { FieldSize } from "./primitives/fieldStyles"

/**
 * `list`, the default, stacks or rows the options each behind its own circle. `segmented` draws
 * them as one row of buttons, the chosen one filled: for a short closed question, typically two
 * or three one-word answers, where the options read better as a choice than as a list.
 */
export type RadioGroupVariant = "list" | "segmented"

interface RadioGroupContextValue {
  fieldSize: FieldSize
  state: RadioGroupState
  variant: RadioGroupVariant
  fillWidth: boolean
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

const segmentedListCss = css`
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-3);
`

/**
 * A closed question is the band's subject, not a field label above a control, so it is sized as
 * the heading it reads as. The `segmented` variant applies this to its own legend; a caller whose
 * `list`-variant group is likewise the subject of its own band, not a field among others in a
 * longer form, can pass it as the `label` to get the same weight.
 */
export const questionLegendCss = css`
  color: var(--color-gray-700);
  font-size: var(--font-size-3);
  font-weight: 600;
  line-height: 1.3;
`

/** A description placed above the options, which `segmented` always does. */
const leadingDescriptionCss = css`
  margin-top: var(--space-1);
  margin-bottom: var(--space-3-5);
`

/**
 * The same clearance `leadingDescriptionCss` gives the options below a description — needed on the
 * options themselves when `segmented` has none, so its heading-weight legend isn't left touching
 * the option row underneath it.
 */
const optionsWithoutDescriptionCss = css`
  margin-top: var(--space-3-5);
`

/**
 * Gives the trailing description/error the same 16px clearance from the options above it that
 * `leadingDescriptionCss` gives a leading one below — without it, the fieldset's 4px `gap` reads as
 * a continuation of the last option's own description rather than a separate, group-level note.
 */
const stackedMessagesCss = css`
  margin-top: var(--space-3-5);
`

const resolveRadioListCss = (
  variant: RadioGroupVariant,
  orientation: "vertical" | "horizontal",
): string => {
  if (variant === "segmented") {
    return segmentedListCss
  }
  return orientation === "horizontal" ? radioListHorizontalCss : radioListCss
}

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
  variant?: RadioGroupVariant
  /**
   * `segmented` only — splits the row evenly between options instead of each hugging its own
   * text. For a pair whose labels are long and unevenly sized enough to wrap raggedly; leave unset
   * for a short choice like Yes/No, where hugging the text is the more compact, expected look.
   */
  fillWidth?: boolean
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
    variant = "list",
    fillWidth = false,
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
    ...(field.value === null || field.value === undefined ? {} : { value: String(field.value) }),
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
      orientation,
      isDisabled,
      isReadOnly,
      isRequired,
      isInvalid,
      ...omitUndefined({ "aria-label": ariaLabel }),
    },
    state,
  )

  const isSegmented = variant === "segmented"
  const descriptionBlock = description ? (
    <div {...descriptionProps} className={descriptionCss}>
      {description}
    </div>
  ) : null

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
      <legend {...labelProps} className={isSegmented ? questionLegendCss : stackedLabelCss}>
        {label}
      </legend>

      {isSegmented && descriptionBlock ? (
        <div className={leadingDescriptionCss}>{descriptionBlock}</div>
      ) : null}

      <RadioGroupContext.Provider value={{ fieldSize, state, variant, fillWidth }}>
        <div
          className={cx(
            resolveRadioListCss(variant, orientation),
            isSegmented && !descriptionBlock ? optionsWithoutDescriptionCss : undefined,
          )}
        >
          {children}
        </div>
      </RadioGroupContext.Provider>

      {(!isSegmented && descriptionBlock) || resolvedRenderedError ? (
        <div className={cx(messagesCss, isSegmented ? undefined : stackedMessagesCss)}>
          {!isSegmented ? descriptionBlock : null}
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
