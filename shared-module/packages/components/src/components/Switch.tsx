"use client"

import { cx } from "@emotion/css"
import { useToggleState } from "@react-stately/toggle"
import React, { useId } from "react"
import { mergeProps, useFocusRing, useObjectRef, useSwitch } from "react-aria"

import { resolveFieldDescribedBy, resolveFieldState } from "../lib/utils/field"

import { FieldShell } from "./primitives/FieldShell"
import {
  checkableContentCss,
  checkableInputCss,
  checkableLabelCss,
  checkableRootCss,
  checkableRowCss,
  resolveCheckableSizeCss,
  switchRowCss,
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
// eslint-disable-next-line i18next/no-literal-string
const dataStateTrue = "true"

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
      onFocus,
      onBlur,
      name,
      value,
      "aria-describedby": ariaDescribedBy,
      "aria-invalid": ariaInvalid,
      ...rest
    } = props

    const generatedInputId = useId()
    const inputId = id ?? generatedInputId
    const descriptionId = useId()
    const errorMessageId = useId()
    const resolvedState = resolveFieldState({
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

    const inputRef = useObjectRef(forwardedRef)
    const toggleState = useToggleState({
      isDisabled: resolvedState.isDisabled,
      isReadOnly: resolvedState.isReadOnly,
      isSelected: checked,
      defaultSelected: defaultChecked,
    })
    const inputValue =
      value == null ? undefined : Array.isArray(value) ? value.join(",") : String(value)

    const {
      inputProps,
      isDisabled: isSwitchDisabled,
      isPressed,
      isSelected,
      labelProps,
    } = useSwitch(
      {
        children: label,
        id: inputId,
        name,
        value: inputValue,
        isDisabled: resolvedState.isDisabled,
        isReadOnly: resolvedState.isReadOnly,
        "aria-describedby": describedBy,
      },
      toggleState,
      inputRef,
    )

    const { focusProps, isFocusVisible } = useFocusRing()
    const mergedInputProps = mergeProps(inputProps, focusProps, {
      ...rest,
      onBlur,
      onChange,
      onFocus,
      onKeyDown,
      onKeyUp,
      "aria-invalid": resolvedState.isInvalid ? dataStateTrue : undefined,
      required: resolvedState.isRequired,
    })

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
          {...labelProps}
          className={cx(checkableRowCss, switchRowCss, resolveCheckableSizeCss(fieldSize))}
          data-disabled={isSwitchDisabled ? "true" : "false"}
        >
          <input {...mergedInputProps} ref={inputRef} className={checkableInputCss} />
          <span
            className={switchTrackCss}
            aria-hidden="true"
            data-disabled={isSwitchDisabled ? "true" : "false"}
            data-focus-visible={isFocusVisible ? "true" : "false"}
            data-invalid={resolvedState.isInvalid ? "true" : "false"}
            data-pressed={isPressed ? "true" : "false"}
            data-selected={isSelected ? "true" : "false"}
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
