"use client"

import { css, cx } from "@emotion/css"
import React, { useId, useImperativeHandle, useRef } from "react"
import { VisuallyHidden } from "react-aria"

import { useControllableState } from "../lib/utils/controllable"
import { resolveFieldDescribedBy, resolveFieldState } from "../lib/utils/field"
import {
  applyOtpBackspace,
  applyOtpCharacter,
  applyOtpPaste,
  clampOtpIndex,
  joinOtpSlots,
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
    box-shadow: 0 0 0 var(--focus-ring-width) rgba(8, 69, 122, 0.14);
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

export type OtpFieldProps = React.ComponentPropsWithoutRef<"input"> & {
  label: React.ReactNode
  description?: React.ReactNode
  errorMessage?: React.ReactNode
  fieldSize?: FieldSize
  length?: number
  onComplete?: (value: string) => void
  allowedCharacters?: RegExp
  isDisabled?: boolean
  isReadOnly?: boolean
  isRequired?: boolean
  isInvalid?: boolean
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

function getOtpSlotAriaLabel(index: number) {
  // eslint-disable-next-line i18next/no-literal-string
  return `Code character ${index + 1}`
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
      allowedCharacters = /[0-9]/,
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
      name,
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

    const [otpValue, setOtpValue] = useControllableState<string>({
      value: typeof value === "string" ? value : undefined,
      defaultValue: typeof defaultValue === "string" ? defaultValue : "",
    })
    const hiddenInputRef = useRef<HTMLInputElement>(null)
    const slotRefs = useRef<Array<HTMLInputElement | null>>([])
    useImperativeHandle(forwardedRef, () => hiddenInputRef.current as HTMLInputElement)

    const slots = splitOtpValue(otpValue, length)

    function commitValue(nextValue: string) {
      setOtpValue(nextValue)

      if (hiddenInputRef.current) {
        hiddenInputRef.current.value = nextValue
      }

      if (nextValue.length === length) {
        onComplete?.(nextValue)
      }

      if (onChange && hiddenInputRef.current) {
        const syntheticEvent = {
          currentTarget: hiddenInputRef.current,
          target: hiddenInputRef.current,
        } as React.ChangeEvent<HTMLInputElement>

        onChange(syntheticEvent)
      }
    }

    return (
      <FieldShell
        className={className}
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
        <VisuallyHidden>
          <input
            {...rest}
            id={inputId}
            ref={hiddenInputRef}
            type="text"
            name={name}
            value={otpValue}
            disabled={state.isDisabled}
            readOnly={state.isReadOnly}
            required={state.isRequired}
            aria-describedby={describedBy}
            aria-invalid={state.isInvalid ? "true" : undefined}
            autoComplete="one-time-code"
            onChange={() => {
              return
            }}
          />
        </VisuallyHidden>

        <div className={otpSlotsCss} role="group" aria-describedby={describedBy}>
          {slots.map((slotValue, index) => (
            <input
              key={`${inputId}-${index}`}
              ref={(element) => {
                slotRefs.current[index] = element
              }}
              className={cx(otpSlotCss, resolveOtpSlotSizeCss(fieldSize))}
              type="text"
              inputMode="numeric"
              maxLength={1}
              autoComplete={index === 0 ? "one-time-code" : "off"}
              value={slotValue}
              disabled={state.isDisabled}
              readOnly={state.isReadOnly}
              data-invalid={state.isInvalid ? "true" : "false"}
              aria-label={getOtpSlotAriaLabel(index)}
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
                  event.preventDefault()

                  const result = applyOtpBackspace(slots, index)
                  commitValue(joinOtpSlots(result.slots))
                  slotRefs.current[result.nextIndex]?.focus()
                }
              }}
              onPaste={(event) => {
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
