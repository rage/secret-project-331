"use client"

import { cx } from "@emotion/css"
import { useId } from "react"
import { mergeProps, useFocusRing, useObjectRef, useRadio } from "react-aria"

import { joinAriaDescribedBy } from "../../lib/utils/field"
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
} from "../primitives/checkableStyles"
import { descriptionCss, errorCss } from "../primitives/fieldShellStyles"

import type { RadioContextValue, RadioInnerProps } from "./radioTypes"

// eslint-disable-next-line i18next/no-literal-string
const defaultFieldSize = "md" as const

/** Renders a radio option when nested inside `RadioGroup`. */
export function GroupedRadio({
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
  const radioValue = value == null ? undefined : String(value)
  const {
    inputProps,
    isDisabled: isRadioDisabled,
    isSelected,
    labelProps,
  } = useRadio(
    {
      children: label,
      value: radioValue as string,
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
      data-disabled={String(isRadioDisabled)}
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
        data-disabled={String(isRadioDisabled)}
        data-focus-visible={String(isFocusVisible)}
        data-invalid={String(group.state.isInvalid)}
        data-selected={String(isSelected)}
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
