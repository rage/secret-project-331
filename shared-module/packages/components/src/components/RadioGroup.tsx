"use client"

import { css, cx } from "@emotion/css"
import React, { useId } from "react"

import { useControllableState } from "../lib/utils/controllable"
import { resolveFieldDescribedBy } from "../lib/utils/field"

import {
  descriptionCss,
  errorCss,
  fieldRootCss,
  messagesCss,
  stackedLabelCss,
} from "./primitives/fieldShellStyles"
import type { FieldSize } from "./primitives/fieldStyles"

type RadioGroupContextValue = {
  name: string
  selectedValue: string | null
  setSelectedValue: (value: string) => void
  fieldSize: FieldSize
  isDisabled: boolean
  isReadOnly: boolean
  isRequired: boolean
  isInvalid: boolean
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
      name: nameProp,
      "aria-describedby": ariaDescribedBy,
      ...rest
    } = props

    const descriptionId = useId()
    const errorMessageId = useId()
    const generatedName = useId().replace(/:/g, "")
    // eslint-disable-next-line i18next/no-literal-string
    const name = nameProp ?? `radio-group-${generatedName}`
    const describedBy = resolveFieldDescribedBy({
      ariaDescribedBy,
      descriptionId,
      errorMessageId,
      hasDescription: Boolean(description),
      hasErrorMessage: Boolean(errorMessage),
    })

    const [selectedValue, setSelectedValue] = useControllableState<string | null>({
      value,
      defaultValue: defaultValue ?? null,
      onChange: (nextValue) => {
        if (nextValue !== null) {
          onChange?.(nextValue)
        }
      },
    })

    return (
      <fieldset
        {...rest}
        ref={forwardedRef}
        className={cx(fieldRootCss, fieldsetCss, className)}
        role="radiogroup"
        aria-describedby={describedBy}
        aria-invalid={isInvalid ? "true" : undefined}
        disabled={isDisabled}
      >
        <legend className={stackedLabelCss}>{label}</legend>
        <RadioGroupContext.Provider
          value={{
            name,
            selectedValue,
            setSelectedValue,
            fieldSize,
            isDisabled,
            isReadOnly,
            isRequired,
            isInvalid,
          }}
        >
          <div className={orientation === "horizontal" ? radioListHorizontalCss : radioListCss}>
            {children}
          </div>
        </RadioGroupContext.Provider>

        {description || errorMessage ? (
          <div className={messagesCss}>
            {description ? (
              <div className={descriptionCss} id={descriptionId}>
                {description}
              </div>
            ) : null}
            {errorMessage ? (
              <div className={errorCss} id={errorMessageId} role="alert">
                {errorMessage}
              </div>
            ) : null}
          </div>
        ) : null}
      </fieldset>
    )
  },
)
