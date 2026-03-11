"use client"

import { cx } from "@emotion/css"
import React, { useId, useImperativeHandle, useRef, useState } from "react"
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
  resolveCheckableSizeCss,
  switchThumbCss,
  switchTrackCss,
} from "./primitives/checkableStyles"
import type { FieldSize } from "./primitives/fieldStyles"

export type SwitchProps = React.ComponentPropsWithoutRef<"input"> & {
  label: React.ReactNode
  description?: React.ReactNode
  errorMessage?: React.ReactNode
  fieldSize?: FieldSize
  isDisabled?: boolean
  isReadOnly?: boolean
  isRequired?: boolean
  isInvalid?: boolean
}

// eslint-disable-next-line i18next/no-literal-string
const stackedLayout = "stacked" as const

export const Switch = React.forwardRef<HTMLInputElement, SwitchProps>(
  function Switch(props, forwardedRef) {
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
    const [isPressed, setIsPressed] = useState(false)
    const { focusProps, isFocusVisible } = useFocusRing()
    const inputRef = useRef<HTMLInputElement>(null)
    useImperativeHandle(forwardedRef, () => inputRef.current as HTMLInputElement)

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
          onPointerDown={() => {
            setIsPressed(true)
          }}
          onPointerUp={() => {
            setIsPressed(false)
          }}
          onPointerLeave={() => {
            setIsPressed(false)
          }}
        >
          <input
            {...rest}
            {...focusProps}
            id={inputId}
            ref={inputRef}
            className={checkableInputCss}
            type="checkbox"
            role="switch"
            checked={isSelected}
            disabled={state.isDisabled}
            required={state.isRequired}
            aria-describedby={describedBy}
            aria-invalid={state.isInvalid ? "true" : undefined}
            onChange={(event) => {
              if (state.isReadOnly) {
                return
              }

              setIsSelected(event.currentTarget.checked)
              onChange?.(event)
            }}
            onKeyDown={(event) => {
              if (event.key === " ") {
                event.preventDefault()
                setIsPressed(true)
              }

              onKeyDown?.(event)
            }}
            onKeyUp={(event) => {
              if (event.key === " ") {
                event.preventDefault()
                setIsPressed(false)
                if (!state.isReadOnly && !state.isDisabled) {
                  inputRef.current?.click()
                }
              }

              onKeyUp?.(event)
            }}
          />
          <span
            className={switchTrackCss}
            aria-hidden="true"
            data-selected={isSelected ? "true" : "false"}
            data-disabled={state.isDisabled ? "true" : "false"}
            data-invalid={state.isInvalid ? "true" : "false"}
            data-focus-visible={isFocusVisible ? "true" : "false"}
            data-pressed={isPressed ? "true" : "false"}
          >
            <span className={switchThumbCss} data-selected={isSelected ? "true" : "false"} />
          </span>
          <span className={checkableContentCss}>
            <span className={checkableLabelCss}>{label}</span>
          </span>
        </label>
      </FieldShell>
    )
  },
)
