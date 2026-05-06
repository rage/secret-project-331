"use client"

import { css, cx } from "@emotion/css"
import { useRadioGroupState } from "@react-stately/radio"
import type { RadioGroupState } from "@react-stately/radio"
import React from "react"
import { useRadioGroup } from "react-aria"

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

export type RadioGroupProps = Omit<React.ComponentPropsWithoutRef<"fieldset">, "onChange"> & {
  label: React.ReactNode
  description?: React.ReactNode
  errorMessage?: React.ReactNode
  fieldSize?: FieldSize
  isDisabled?: boolean
  isReadOnly?: boolean
  isRequired?: boolean
  isInvalid?: boolean
  value?: string
  defaultValue?: string
  onChange?: (value: string) => void
  orientation?: "vertical" | "horizontal"
}

export const RadioGroup = React.forwardRef<HTMLFieldSetElement, RadioGroupProps>(
  function RadioGroup(props, forwardedRef) {
    const {
      label,
      description,
      errorMessage,
      fieldSize = "md",
      disabled,
      isDisabled = false,
      isReadOnly = false,
      isRequired = false,
      isInvalid = Boolean(errorMessage),
      value,
      defaultValue,
      onChange,
      orientation = "vertical",
      className,
      children,
      name,
      ...rest
    } = props

    const resolvedIsDisabled = isDisabled || disabled || false

    const state = useRadioGroupState({
      value,
      defaultValue,
      onChange,
      name,
      isDisabled: resolvedIsDisabled,
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
        errorMessage,
        name,
        orientation,
        isDisabled: resolvedIsDisabled,
        isReadOnly,
        isRequired,
        isInvalid,
      },
      state,
    )

    const resolvedErrorMessage =
      errorMessage ??
      (hookIsInvalid && validationErrors.length > 0 ? validationErrors.join(" ") : null)

    return (
      <fieldset
        {...rest}
        {...radioGroupProps}
        ref={forwardedRef}
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

        {description || resolvedErrorMessage ? (
          <div className={messagesCss}>
            {description ? (
              <div {...descriptionProps} className={descriptionCss}>
                {description}
              </div>
            ) : null}
            {resolvedErrorMessage ? (
              <div {...errorMessageProps} className={errorCss} role="alert">
                {resolvedErrorMessage}
              </div>
            ) : null}
          </div>
        ) : null}
      </fieldset>
    )
  },
)
