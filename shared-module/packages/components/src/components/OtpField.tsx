"use client"

import { css, cx } from "@emotion/css"
import React, { useEffect, useId, useImperativeHandle, useRef } from "react"
import { mergeProps, useField, VisuallyHidden } from "react-aria"
import type { FieldValues, Path } from "react-hook-form"
import { useTranslation } from "react-i18next"

import { type RhfFieldProps, useRhfField } from "../lib/types/rhfField"
import { findFirstMatchingChild } from "../lib/utils/compositeField"
import { resolveFieldDescribedBy } from "../lib/utils/field"
import {
  applyOtpBackspace,
  applyOtpCharacter,
  applyOtpPaste,
  clampOtpIndex,
  joinOtpSlots,
  type OtpAllowedCharacters,
  resolveOtpSlotAriaLabel,
  splitOtpValue,
} from "../lib/utils/otp"

import { FieldShell } from "./primitives/FieldShell"
import type { FieldSize } from "./primitives/fieldStyles"

const otpSlotsCss = css`
  display: flex;
  gap: var(--space-2);
  flex-wrap: wrap;
`

const otpSlotCss = css`
  width: 44px;
  height: 52px;
  border: 1px solid var(--field-border);
  border-radius: calc(var(--control-radius) + 4px);
  background: var(--field-bg);
  color: var(--field-fg);
  font-size: 1.25rem;
  text-align: center;
  outline: none;
  transition:
    border-color 0.18s ease,
    box-shadow 0.18s ease;

  &:focus {
    border-color: var(--field-border-focus);
    box-shadow: 0 0 0 var(--focus-ring-width) var(--focus-ring-color);
  }

  &[data-invalid="true"] {
    border-color: var(--field-error-border);
  }

  &:disabled {
    background: var(--field-disabled-bg);
    border-color: var(--field-disabled-border);
    color: var(--field-disabled-fg);
    cursor: not-allowed;
  }
`

const otpSlotSmCss = css`
  width: 36px;
  height: 44px;
  font-size: 1rem;
`

const otpSlotMdCss = css`
  width: 44px;
  height: 52px;
  font-size: 1.25rem;
`

const otpSlotLgCss = css`
  width: 52px;
  height: 60px;
  font-size: 1.4rem;
`

// oxlint-disable-next-line i18next/no-literal-string
const stackedLayout = "stacked" as const
// oxlint-disable-next-line i18next/no-literal-string
const slotInputSelector = "input"

function resolveOtpSlotSizeCss(fieldSize: FieldSize) {
  switch (fieldSize) {
    case "sm":
      return otpSlotSmCss
    case "lg":
      return otpSlotLgCss
    default:
      return otpSlotMdCss
  }
}

/**
 * One-time code entry with multiple slots and hidden input for autofill.
 * Uses react-hook-form; pass `name` and `control`. Field value is the full OTP string.
 * The hidden input mirrors the value for browser OTP autofill (`autoComplete` such as `one-time-code`); RHF is
 * driven by `field.onChange` from the slots, not by relying on the hidden input as the source of truth.
 *
 * @example
 * <OtpField name="code" control={control} label="Code" length={6} />
 */
export type OtpFieldProps<T extends FieldValues, N extends Path<T> = Path<T>> = RhfFieldProps<
  T,
  N
> & {
  label: React.ReactNode
  description?: React.ReactNode
  errorMessage?: React.ReactNode
  fieldSize?: FieldSize
  length?: number
  onComplete?: (value: string) => void
  allowedCharacters?: OtpAllowedCharacters
  getSlotAriaLabel?: (index: number, length: number) => string
  isDisabled?: boolean
  isReadOnly?: boolean
  isRequired?: boolean
  id?: string
  autoComplete?: string
  className?: string
}

export function OtpField<T extends FieldValues, N extends Path<T> = Path<T>>(
  props: OtpFieldProps<T, N>,
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
    length = 6,
    onComplete,
    allowedCharacters = /[0-9]/,
    getSlotAriaLabel,
    isDisabled = false,
    isReadOnly = false,
    isRequired = false,
    className,
    autoComplete,
  } = props

  const { field, resolvedError, isInvalid } = useRhfField({ name, control, rules, errorMessage })

  const { t } = useTranslation("shared-module")
  const generatedInputId = useId()
  const inputId = id ?? generatedInputId
  const hiddenInputRef = useRef<HTMLInputElement>(null)
  const slotsContainerRef = useRef<HTMLDivElement>(null)
  const slotRefs = useRef<(HTMLInputElement | null)[]>([])
  const hasFocusWithinRef = useRef(false)

  useImperativeHandle(field.ref, () => {
    return (slotRefs.current[0] ??
      findFirstMatchingChild<HTMLInputElement>(
        slotsContainerRef.current,
        slotInputSelector,
      )) as HTMLInputElement
  })

  const descriptionId = useId()
  const errorMessageId = useId()
  const { labelProps, fieldProps, descriptionProps, errorMessageProps } = useField({
    label,
    description,
    errorMessage: resolvedError,
    id: inputId,
    isInvalid,
  })
  const {
    id: labelTargetId = inputId,
    "aria-labelledby": fieldAriaLabelledBy,
    ...groupFieldProps
  } = fieldProps
  const groupAriaLabelledBy = Array.from(
    new Set(
      [fieldAriaLabelledBy, labelProps.id]
        .flatMap((value) => (typeof value === "string" ? value.split(" ") : []))
        .filter((value) => value.length > 0),
    ),
  ).join(" ")
  const mergedLabelProps = mergeProps(labelProps, {
    onClick: () => {
      if (isDisabled) {
        return
      }

      slotRefs.current[0]?.focus()
    },
  })

  const otpValue = typeof field.value === "string" ? field.value : ""

  useEffect(() => {
    if (hiddenInputRef.current) {
      hiddenInputRef.current.value = otpValue
    }
  }, [otpValue])

  const describedBy = resolveFieldDescribedBy({
    ariaDescribedBy: undefined,
    descriptionId,
    errorMessageId,
    hasDescription: Boolean(description),
    hasErrorMessage: Boolean(resolvedError),
  })

  const slots = splitOtpValue(otpValue, length)

  const commitValue = (nextValue: string) => {
    field.onChange(nextValue)
    if (hiddenInputRef.current) {
      hiddenInputRef.current.value = nextValue
    }
    if (nextValue.length === length) {
      onComplete?.(nextValue)
    }
  }

  return (
    <FieldShell
      className={className}
      label={label}
      labelProps={mergedLabelProps as React.HTMLAttributes<HTMLElement>}
      description={description}
      descriptionProps={descriptionProps as React.HTMLAttributes<HTMLElement>}
      errorMessage={resolvedError}
      errorMessageProps={errorMessageProps as React.HTMLAttributes<HTMLElement>}
      isDisabled={isDisabled}
      isRequired={isRequired}
      layout={stackedLayout}
    >
      {/* Autofill target; RHF value flows from slot handlers, not this input's events. */}
      <VisuallyHidden>
        <input
          ref={hiddenInputRef}
          type="text"
          name={field.name}
          value={otpValue}
          disabled={isDisabled}
          readOnly={isReadOnly}
          required={isRequired}
          aria-hidden="true"
          tabIndex={-1}
          autoComplete={autoComplete ?? "one-time-code"}
          aria-describedby={describedBy}
          onChange={() => {}}
        />
      </VisuallyHidden>

      <div
        {...groupFieldProps}
        ref={slotsContainerRef}
        className={otpSlotsCss}
        // oxlint-disable-next-line jsx-a11y/prefer-tag-over-role -- styled div typed HTMLDivElement; a native tag changes behavior
        role="group"
        aria-labelledby={groupAriaLabelledBy || undefined}
        aria-disabled={isDisabled ? "true" : undefined}
        onBlur={(event) => {
          if (slotsContainerRef.current?.contains(event.relatedTarget as Node | null)) {
            return
          }

          hasFocusWithinRef.current = false
          field.onBlur()
        }}
        onFocus={() => {
          if (hasFocusWithinRef.current) {
            return
          }

          hasFocusWithinRef.current = true
        }}
      >
        {slots.map((slotValue, index) => (
          <input
            key={`${inputId}-${index}`}
            id={index === 0 ? labelTargetId : undefined}
            ref={(element) => {
              slotRefs.current[index] = element
            }}
            className={cx(otpSlotCss, resolveOtpSlotSizeCss(fieldSize))}
            type="text"
            inputMode="numeric"
            maxLength={1}
            autoComplete={index === 0 ? (autoComplete ?? "one-time-code") : "off"}
            value={slotValue}
            disabled={isDisabled}
            readOnly={isReadOnly}
            data-invalid={isInvalid ? "true" : "false"}
            aria-invalid={isInvalid ? "true" : undefined}
            aria-required={index === 0 && isRequired ? "true" : undefined}
            aria-label={resolveOtpSlotAriaLabel(index, length, getSlotAriaLabel, (slotIndex) =>
              t("otp.slotLabel", { index: slotIndex + 1 }),
            )}
            onChange={(event) => {
              if (isReadOnly) {
                return
              }

              const result = applyOtpCharacter(
                slots,
                index,
                event.currentTarget.value,
                allowedCharacters,
              )
              const nextValue = joinOtpSlots(result.slots)

              commitValue(nextValue)
              slotRefs.current[result.nextIndex]?.focus()
            }}
            onKeyDown={(event) => {
              if (event.key === "ArrowLeft") {
                event.preventDefault()
                slotRefs.current[clampOtpIndex(index - 1, length)]?.focus()
              } else if (event.key === "ArrowRight") {
                event.preventDefault()
                slotRefs.current[clampOtpIndex(index + 1, length)]?.focus()
              } else if (event.key === "Backspace") {
                if (isReadOnly) {
                  return
                }

                event.preventDefault()

                const result = applyOtpBackspace(slots, index)
                commitValue(joinOtpSlots(result.slots))
                slotRefs.current[result.nextIndex]?.focus()
              }
            }}
            onPaste={(event) => {
              if (isReadOnly) {
                return
              }

              event.preventDefault()

              const pastedText = event.clipboardData.getData("text")
              const result = applyOtpPaste(slots, index, pastedText, allowedCharacters)
              commitValue(joinOtpSlots(result.slots))
              slotRefs.current[result.nextIndex]?.focus()
            }}
          />
        ))}
      </div>
    </FieldShell>
  )
}
