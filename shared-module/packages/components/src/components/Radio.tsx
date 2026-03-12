"use client"

import { cx } from "@emotion/css"
import React, { useContext, useId } from "react"
import { useFocusRing } from "react-aria"

import { resolveFieldState } from "../lib/utils/field"

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

export const Radio = React.forwardRef<HTMLInputElement, RadioProps>(
  function Radio(props, forwardedRef) {
    const {
      label,
      description,
      errorMessage,
      fieldSize,
      isDisabled,
      className,
      value,
      disabled,
      "aria-describedby": ariaDescribedBy,
      onChange,
      required,
      ...rest
    } = props

    const group = useContext(RadioGroupContext)
    const { focusProps, isFocusVisible } = useFocusRing()
    const descriptionId = useId()
    const errorMessageId = useId()

    const state = resolveFieldState({
      isDisabled: Boolean(group?.isDisabled || isDisabled || disabled),
      isRequired: Boolean(group?.isRequired || required),
      isInvalid: Boolean(group?.isInvalid || errorMessage),
    })

    const radioValue = value == null ? "" : String(value)
    const selectedValue = group?.selectedValue
    const isSelected = selectedValue === radioValue
    const resolvedFieldSize = fieldSize ?? group?.fieldSize ?? defaultFieldSize

    return (
      <label
        className={cx(checkableRowCss, resolveCheckableSizeCss(resolvedFieldSize), className)}
        data-disabled={state.isDisabled ? "true" : "false"}
      >
        <input
          {...rest}
          {...focusProps}
          ref={forwardedRef}
          className={checkableInputCss}
          type="radio"
          value={radioValue}
          name={group?.name ?? props.name}
          checked={group ? isSelected : props.checked}
          defaultChecked={group ? undefined : props.defaultChecked}
          disabled={state.isDisabled}
          required={state.isRequired}
          aria-describedby={
            group
              ? undefined
              : [
                  ariaDescribedBy,
                  description ? descriptionId : undefined,
                  errorMessage ? errorMessageId : undefined,
                ]
                  .filter(Boolean)
                  .join(" ") || undefined
          }
          onKeyDown={(event) => {
            if (
              group &&
              (event.key === "ArrowRight" ||
                event.key === "ArrowDown" ||
                event.key === "ArrowLeft" ||
                event.key === "ArrowUp")
            ) {
              event.preventDefault()

              const direction = event.key === "ArrowRight" || event.key === "ArrowDown" ? 1 : -1
              const groupRoot = event.currentTarget.closest<HTMLElement>('[role="radiogroup"]')
              if (!groupRoot) {
                return
              }

              const radioInputs = Array.from(
                groupRoot.querySelectorAll<HTMLInputElement>('input[type="radio"]'),
              ).filter((input) => input.name === group.name && !input.disabled)

              const currentIndex = radioInputs.findIndex((input) => input === event.currentTarget)
              if (currentIndex >= 0 && radioInputs.length > 0) {
                const nextIndex =
                  (currentIndex + direction + radioInputs.length) % radioInputs.length
                const nextInput = radioInputs[nextIndex]

                if (nextInput) {
                  nextInput.focus()
                  if (!group.isReadOnly) {
                    group.setSelectedValue(nextInput.value)
                  }
                }
              }
            }
          }}
          onChange={(event) => {
            if (!group?.isReadOnly) {
              group?.setSelectedValue(radioValue)
            }
            onChange?.(event)
          }}
        />
        <span
          className={resolveChoiceIndicatorCss(resolvedFieldSize, "radio")}
          aria-hidden="true"
          data-selected={isSelected ? "true" : "false"}
          data-disabled={state.isDisabled ? "true" : "false"}
          data-invalid={group?.isInvalid ? "true" : "false"}
          data-focus-visible={isFocusVisible ? "true" : "false"}
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
  },
)
