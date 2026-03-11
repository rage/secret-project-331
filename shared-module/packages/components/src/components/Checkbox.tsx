"use client"

import { cx } from "@emotion/css"
import React, { useEffect, useId, useImperativeHandle, useRef } from "react"
import { useFocusRing } from "react-aria"

import { useControllableState } from "../lib/utils/controllable"
import { resolveFieldDescribedBy, resolveFieldState } from "../lib/utils/field"

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

export type CheckboxProps = React.ComponentPropsWithoutRef<"input"> & {
  label: React.ReactNode
  description?: React.ReactNode
  errorMessage?: React.ReactNode
  fieldSize?: FieldSize
  isDisabled?: boolean
  isReadOnly?: boolean
  isRequired?: boolean
  isInvalid?: boolean
  isIndeterminate?: boolean
}

// eslint-disable-next-line i18next/no-literal-string
const stackedLayout = "stacked" as const

export const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
  function Checkbox(props, forwardedRef) {
    const {
      id,
      label,
      description,
      errorMessage,
      fieldSize = "md",
      isDisabled,
      isReadOnly,
      isRequired,
      isInvalid,
      isIndeterminate = false,
      className,
      checked,
      defaultChecked,
      disabled,
      readOnly,
      required,
      onChange,
      onKeyDown,
      onKeyUp,
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

    const [isSelected, setIsSelected] = useControllableState({
      value: checked,
      defaultValue: defaultChecked ?? false,
    })
    const inputRef = useRef<HTMLInputElement>(null)
    useImperativeHandle(forwardedRef, () => inputRef.current as HTMLInputElement)

    useEffect(() => {
      if (inputRef.current) {
        inputRef.current.indeterminate = isIndeterminate
      }
    }, [isIndeterminate])

    const { focusProps, isFocusVisible } = useFocusRing()
    const showCheck = isSelected && !isIndeterminate

    return (
      <FieldShell
        className={cx(checkableRootCss, className)}
        description={description}
        descriptionId={description ? descriptionId : undefined}
        errorMessage={errorMessage}
        errorMessageId={errorMessage ? errorMessageId : undefined}
        layout={stackedLayout}
      >
        <label
          className={cx(checkableRowCss, resolveCheckableSizeCss(fieldSize))}
          data-disabled={state.isDisabled ? "true" : "false"}
        >
          <input
            {...rest}
            {...focusProps}
            id={inputId}
            ref={inputRef}
            className={checkableInputCss}
            type="checkbox"
            checked={isSelected}
            disabled={state.isDisabled}
            required={state.isRequired}
            aria-describedby={describedBy}
            aria-invalid={state.isInvalid ? "true" : undefined}
            aria-checked={isIndeterminate ? "mixed" : isSelected}
            onKeyDown={(event) => {
              if (event.key === " ") {
                event.preventDefault()
              }
              onKeyDown?.(event)
            }}
            onKeyUp={(event) => {
              if (event.key === " ") {
                event.preventDefault()

                if (!state.isReadOnly && !state.isDisabled) {
                  inputRef.current?.click()
                }
              }
              onKeyUp?.(event)
            }}
            onChange={(event) => {
              if (state.isReadOnly) {
                return
              }

              setIsSelected(event.currentTarget.checked)
              onChange?.(event)
            }}
          />
          <span
            className={resolveChoiceIndicatorCss(fieldSize, "checkbox")}
            aria-hidden="true"
            data-selected={isSelected ? "true" : "false"}
            data-disabled={state.isDisabled ? "true" : "false"}
            data-invalid={state.isInvalid ? "true" : "false"}
            data-indeterminate={isIndeterminate ? "true" : "false"}
            data-focus-visible={isFocusVisible ? "true" : "false"}
          >
            {showCheck ? (
              <span className={cx(choiceMarkCss, choiceMarkVisibleCss, checkboxMarkCss)} />
            ) : null}
            {isIndeterminate ? (
              <span className={cx(choiceMarkCss, choiceMarkVisibleCss, indeterminateMarkCss)} />
            ) : null}
          </span>
          <span className={checkableContentCss}>
            <span className={checkableLabelCss}>{label}</span>
          </span>
        </label>
      </FieldShell>
    )
  },
)
