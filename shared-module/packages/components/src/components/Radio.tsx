"use client"

import { cx } from "@emotion/css"
import React, { useContext, useId } from "react"
import { mergeProps, useFocusRing, useObjectRef, useRadio } from "react-aria"

import { useControllableState } from "../lib/utils/controllable"
import { joinAriaDescribedBy, resolveFieldState } from "../lib/utils/field"

import { RadioGroupContext } from "./RadioGroup"
import {
  checkableContentCss,
  checkableInputCss,
  checkableLabelCss,
  checkableRowCss,
  choiceMarkCss,
  choiceMarkVisibleCss,
  radioMarkCss,
  resolveCheckableSizeCss,
  resolveChoiceIndicatorCss,
} from "./primitives/checkableStyles"
import { descriptionCss, errorCss } from "./primitives/fieldShellStyles"
import type { FieldSize } from "./primitives/fieldStyles"

export type RadioProps = React.ComponentPropsWithoutRef<"input"> & {
  label: React.ReactNode
  description?: React.ReactNode
  errorMessage?: React.ReactNode
  fieldSize?: FieldSize
  isDisabled?: boolean
}

// eslint-disable-next-line i18next/no-literal-string
const defaultFieldSize: FieldSize = "md"

type RadioContextValue = NonNullable<React.ContextType<typeof RadioGroupContext>>

type RadioInnerProps = RadioProps & {
  forwardedRef: React.ForwardedRef<HTMLInputElement>
}

function GroupedRadio({
  forwardedRef,
  group,
  ...props
}: RadioInnerProps & { group: RadioContextValue }) {
  const {
    label,
    description,
    errorMessage,
    fieldSize,
    isDisabled,
    className,
    value,
    disabled,
    checked: _checked,
    defaultChecked: _defaultChecked,
    "aria-describedby": ariaDescribedBy,
    onChange,
    required: _required,
    ...rest
  } = props

  const inputRef = useObjectRef(forwardedRef)
  const { focusProps, isFocusVisible } = useFocusRing()
  const descriptionId = useId()
  const errorMessageId = useId()
  const resolvedFieldSize = fieldSize ?? group.fieldSize ?? defaultFieldSize
  const radioValue = value == null ? "" : String(value)
  const {
    inputProps,
    isDisabled: isRadioDisabled,
    isSelected,
    labelProps,
  } = useRadio(
    {
      value: radioValue,
      isDisabled: Boolean(isDisabled || disabled),
    },
    group.state,
    inputRef,
  )

  const describedBy = joinAriaDescribedBy(
    typeof inputProps["aria-describedby"] === "string" ? inputProps["aria-describedby"] : undefined,
    ariaDescribedBy,
    description ? descriptionId : undefined,
    errorMessage ? errorMessageId : undefined,
  )

  const mergedInputProps = mergeProps(inputProps, focusProps, {
    ...rest,
    onChange,
  })

  return (
    <label
      {...labelProps}
      className={cx(checkableRowCss, resolveCheckableSizeCss(resolvedFieldSize), className)}
      data-disabled={isRadioDisabled ? "true" : "false"}
    >
      <input
        {...mergedInputProps}
        ref={inputRef}
        className={checkableInputCss}
        aria-describedby={describedBy}
      />
      <span
        className={resolveChoiceIndicatorCss(resolvedFieldSize, "radio")}
        aria-hidden="true"
        data-disabled={isRadioDisabled ? "true" : "false"}
        data-focus-visible={isFocusVisible ? "true" : "false"}
        data-invalid={group.state.isInvalid ? "true" : "false"}
        data-selected={isSelected ? "true" : "false"}
      >
        {isSelected ? (
          <span className={cx(choiceMarkCss, choiceMarkVisibleCss, radioMarkCss)} />
        ) : null}
      </span>
      <span className={checkableContentCss}>
        <span className={checkableLabelCss}>{label}</span>
        {description ? (
          <span className={descriptionCss} id={descriptionId}>
            {description}
          </span>
        ) : null}
        {errorMessage ? (
          <span className={errorCss} id={errorMessageId} role="alert">
            {errorMessage}
          </span>
        ) : null}
      </span>
    </label>
  )
}

function StandaloneRadio({ forwardedRef, ...props }: RadioInnerProps) {
  const {
    label,
    description,
    errorMessage,
    fieldSize,
    isDisabled,
    className,
    value,
    disabled,
    checked,
    defaultChecked,
    "aria-describedby": ariaDescribedBy,
    onChange,
    required,
    ...rest
  } = props

  const inputRef = useObjectRef(forwardedRef)
  const { focusProps, isFocusVisible } = useFocusRing()
  const descriptionId = useId()
  const errorMessageId = useId()
  const resolvedFieldSize = fieldSize ?? defaultFieldSize
  const radioValue = value == null ? "" : String(value)
  const standaloneState = resolveFieldState({
    isDisabled: Boolean(isDisabled || disabled),
    isRequired: Boolean(required),
    isInvalid: Boolean(errorMessage),
  })
  const [isSelected, setIsSelected] = useControllableState({
    value: checked,
    defaultValue: defaultChecked ?? false,
  })
  const describedBy = joinAriaDescribedBy(
    ariaDescribedBy,
    description ? descriptionId : undefined,
    errorMessage ? errorMessageId : undefined,
  )

  return (
    <label
      className={cx(checkableRowCss, resolveCheckableSizeCss(resolvedFieldSize), className)}
      data-disabled={standaloneState.isDisabled ? "true" : "false"}
    >
      <input
        {...rest}
        {...focusProps}
        ref={inputRef}
        className={checkableInputCss}
        type="radio"
        checked={isSelected}
        disabled={standaloneState.isDisabled}
        required={standaloneState.isRequired}
        value={radioValue}
        aria-describedby={describedBy}
        onChange={(event) => {
          setIsSelected(event.currentTarget.checked)
          onChange?.(event)
        }}
      />
      <span
        className={resolveChoiceIndicatorCss(resolvedFieldSize, "radio")}
        aria-hidden="true"
        data-disabled={standaloneState.isDisabled ? "true" : "false"}
        data-focus-visible={isFocusVisible ? "true" : "false"}
        data-invalid={standaloneState.isInvalid ? "true" : "false"}
        data-selected={isSelected ? "true" : "false"}
      >
        {isSelected ? (
          <span className={cx(choiceMarkCss, choiceMarkVisibleCss, radioMarkCss)} />
        ) : null}
      </span>
      <span className={checkableContentCss}>
        <span className={checkableLabelCss}>{label}</span>
        {description ? (
          <span className={descriptionCss} id={descriptionId}>
            {description}
          </span>
        ) : null}
        {errorMessage ? (
          <span className={errorCss} id={errorMessageId} role="alert">
            {errorMessage}
          </span>
        ) : null}
      </span>
    </label>
  )
}

export const Radio = React.forwardRef<HTMLInputElement, RadioProps>(
  function Radio(props, forwardedRef) {
    const group = useContext(RadioGroupContext)

    if (group) {
      return <GroupedRadio {...props} forwardedRef={forwardedRef} group={group} />
    }

    return <StandaloneRadio {...props} forwardedRef={forwardedRef} />
  },
)
