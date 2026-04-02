"use client"

import { css, cx } from "@emotion/css"
import React, { useEffect, useId, useImperativeHandle, useRef } from "react"
import { mergeProps, useField, VisuallyHidden } from "react-aria"
import { useTranslation } from "react-i18next"

import type { DivDomProps, InputDomProps } from "../lib/types/domProps"
import {
  composeRefs,
  emitSyntheticBlur,
  emitSyntheticChange,
  emitSyntheticFocus,
  findFirstMatchingChild,
  syncHiddenInputValue,
} from "../lib/utils/compositeField"
import { useControllableState } from "../lib/utils/controllable"
import { resolveFieldState } from "../lib/utils/field"
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

export type OtpFieldProps = {
  label: React.ReactNode
  description?: React.ReactNode
  errorMessage?: React.ReactNode
  fieldSize?: FieldSize
  length?: number
  value?: string
  defaultValue?: string
  onChange?: React.ChangeEventHandler<HTMLInputElement>
  onValueChange?: (value: string) => void
  onComplete?: (value: string) => void
  allowedCharacters?: OtpAllowedCharacters
  inputRef?: React.Ref<HTMLInputElement>
  getSlotAriaLabel?: (index: number, length: number) => string
  isDisabled?: boolean
  isReadOnly?: boolean
  isRequired?: boolean
  isInvalid?: boolean
  id?: string
  name?: string
  autoComplete?: string
  disabled?: boolean
  readOnly?: boolean
  required?: boolean
  onFocus?: React.FocusEventHandler<HTMLInputElement>
  onBlur?: React.FocusEventHandler<HTMLInputElement>
  "aria-describedby"?: string
  "aria-invalid"?: React.AriaAttributes["aria-invalid"]
  className?: string
  inputDomProps?: InputDomProps
  domProps?: DivDomProps
}

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

// eslint-disable-next-line i18next/no-literal-string
const stackedLayout = "stacked" as const

function resolveOtpSlotSizeCss(fieldSize: FieldSize) {
  switch (fieldSize) {
    case "sm":
      return otpSlotSmCss
    case "lg":
      return otpSlotLgCss
    case "md":
    default:
      return otpSlotMdCss
  }
}

export const OtpField = React.forwardRef<HTMLInputElement, OtpFieldProps>(
  function OtpField(props, forwardedRef) {
    const {
      id,
      label,
      description,
      errorMessage,
      fieldSize = "md",
      length = 6,
      onComplete,
      onValueChange,
      allowedCharacters = /[0-9]/,
      getSlotAriaLabel,
      inputRef,
      isDisabled,
      isReadOnly,
      isRequired,
      isInvalid,
      className,
      value,
      defaultValue,
      disabled,
      readOnly,
      required,
      onChange,
      onFocus,
      onBlur,
      name,
      autoComplete,
      "aria-describedby": ariaDescribedBy,
      "aria-invalid": ariaInvalid,
      inputDomProps,
      domProps,
    } = props

    const { t } = useTranslation("shared-module")
    const generatedInputId = useId()
    const inputId = id ?? generatedInputId
    const hiddenInputRef = useRef<HTMLInputElement>(null)
    const slotsContainerRef = useRef<HTMLDivElement>(null)
    const slotRefs = useRef<Array<HTMLInputElement | null>>([])
    const hasFocusWithinRef = useRef(false)
    // eslint-disable-next-line i18next/no-literal-string -- DOM selector, not UI copy
    const slotInputSelector = "input"

    useImperativeHandle(forwardedRef, () => {
      return (slotRefs.current[0] ??
        findFirstMatchingChild<HTMLInputElement>(
          slotsContainerRef.current,
          slotInputSelector,
        )) as HTMLInputElement
    })

    const mergedInputRef = composeRefs(hiddenInputRef, inputRef)
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
    const { labelProps, fieldProps, descriptionProps, errorMessageProps } = useField({
      label,
      description,
      errorMessage,
      id: inputId,
      isInvalid: state.isInvalid,
      "aria-describedby": ariaDescribedBy,
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
        if (state.isDisabled) {
          return
        }

        slotRefs.current[0]?.focus()
      },
    })

    const [otpValue, setOtpValue] = useControllableState<string>({
      value: typeof value === "string" ? value : undefined,
      defaultValue: typeof defaultValue === "string" ? defaultValue : "",
      onChange: onValueChange,
    })

    useEffect(() => {
      syncHiddenInputValue(hiddenInputRef.current, otpValue)
    }, [otpValue])

    const slots = splitOtpValue(otpValue, length)

    const commitValue = (nextValue: string) => {
      setOtpValue(nextValue)
      syncHiddenInputValue(hiddenInputRef.current, nextValue)
      emitSyntheticChange(hiddenInputRef.current, onChange, nextValue)

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
        errorMessage={errorMessage}
        errorMessageProps={errorMessageProps as React.HTMLAttributes<HTMLElement>}
        isDisabled={state.isDisabled}
        isRequired={state.isRequired}
        layout={stackedLayout}
      >
        <VisuallyHidden>
          <input
            {...(inputDomProps ?? {})}
            ref={mergedInputRef}
            type="text"
            name={name}
            value={otpValue}
            disabled={state.isDisabled}
            readOnly={state.isReadOnly}
            required={state.isRequired}
            aria-hidden="true"
            tabIndex={-1}
            autoComplete={autoComplete ?? "one-time-code"}
            onChange={() => {
              return
            }}
          />
        </VisuallyHidden>

        <div
          {...(domProps ?? {})}
          {...groupFieldProps}
          ref={slotsContainerRef}
          className={otpSlotsCss}
          role="group"
          aria-labelledby={groupAriaLabelledBy || undefined}
          aria-disabled={state.isDisabled ? "true" : undefined}
          onBlur={(event) => {
            if (slotsContainerRef.current?.contains(event.relatedTarget as Node | null)) {
              return
            }

            hasFocusWithinRef.current = false
            emitSyntheticBlur(hiddenInputRef.current, onBlur)
          }}
          onFocus={() => {
            if (hasFocusWithinRef.current) {
              return
            }

            hasFocusWithinRef.current = true
            emitSyntheticFocus(hiddenInputRef.current, onFocus)
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
              disabled={state.isDisabled}
              readOnly={state.isReadOnly}
              data-invalid={state.isInvalid ? "true" : "false"}
              aria-invalid={state.isInvalid ? "true" : undefined}
              aria-required={index === 0 && state.isRequired ? "true" : undefined}
              aria-label={resolveOtpSlotAriaLabel(index, length, getSlotAriaLabel, (slotIndex) =>
                t("otp.slotLabel", { index: slotIndex + 1 }),
              )}
              onChange={(event) => {
                if (state.isReadOnly) {
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
                  if (state.isReadOnly) {
                    return
                  }

                  event.preventDefault()

                  const result = applyOtpBackspace(slots, index)
                  commitValue(joinOtpSlots(result.slots))
                  slotRefs.current[result.nextIndex]?.focus()
                }
              }}
              onPaste={(event) => {
                if (state.isReadOnly) {
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
  },
)

OtpField.displayName = "OtpField"
