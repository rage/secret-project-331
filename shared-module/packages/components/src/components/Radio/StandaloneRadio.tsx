"use client"

import { cx } from "@emotion/css"
import { useId } from "react"
import { mergeProps, useFocusRing, useObjectRef } from "react-aria"

import { joinAriaDescribedBy, resolveFieldState } from "../../lib/utils/field"
import {
  checkableContentCss,
  checkableInputCss,
  checkableLabelCss,
  checkableRowCss,
  choiceMarkCss,
  choiceMarkVisibleCss,
  radioMarkCss,
  radioStandaloneNativeIndicatorCss,
  resolveCheckableSizeCss,
  resolveChoiceIndicatorCss,
} from "../primitives/checkableStyles"
import { descriptionCss, errorCss } from "../primitives/fieldShellStyles"

import type { RadioInnerProps } from "./radioTypes"

// eslint-disable-next-line i18next/no-literal-string
const defaultFieldSize = "md" as const

/** Renders a standalone radio input outside of `RadioGroup`. */
export function StandaloneRadio({ forwardedRef, ...props }: RadioInnerProps) {
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
  const radioValue = value == null ? undefined : String(value)
  const isControlled = checked !== undefined
  const standaloneState = resolveFieldState({
    isDisabled: Boolean(isDisabled || disabled),
    isRequired: Boolean(required),
    isInvalid: Boolean(errorMessage),
  })
  const describedBy = joinAriaDescribedBy(
    ariaDescribedBy,
    description ? descriptionId : undefined,
    errorMessage ? errorMessageId : undefined,
  )

  const mergedInputProps = mergeProps(rest, focusProps, {
    className: checkableInputCss,
    type: "radio" as const,
    disabled: standaloneState.isDisabled,
    required: standaloneState.isRequired,
    ...(radioValue !== undefined ? { value: radioValue } : {}),
    "aria-describedby": describedBy,
    ...(isControlled ? { checked, onChange } : { defaultChecked, onChange }),
  })

  return (
    <label
      className={cx(checkableRowCss, resolveCheckableSizeCss(resolvedFieldSize), className)}
      data-disabled={String(standaloneState.isDisabled)}
    >
      <input {...mergedInputProps} ref={inputRef} />
      <span
        className={cx(
          resolveChoiceIndicatorCss(resolvedFieldSize, "radio"),
          !isControlled ? radioStandaloneNativeIndicatorCss : undefined,
        )}
        aria-hidden="true"
        data-disabled={String(standaloneState.isDisabled)}
        data-focus-visible={String(isFocusVisible)}
        data-invalid={String(standaloneState.isInvalid)}
        {...(isControlled ? { "data-selected": String(checked) } : {})}
      >
        {isControlled ? (
          checked ? (
            <span className={cx(choiceMarkCss, choiceMarkVisibleCss, radioMarkCss)} />
          ) : null
        ) : (
          <span className={cx(choiceMarkCss, radioMarkCss)} />
        )}
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
