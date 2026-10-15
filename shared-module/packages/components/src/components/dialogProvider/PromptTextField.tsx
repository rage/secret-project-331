"use client"

import React from "react"
import { mergeProps, useTextField } from "react-aria"

import {
  fieldControlCss,
  fieldRootCss,
  resolveInputCss,
  resolveMessageCss,
} from "../primitives/fieldStyles"
import { PROMPT_DIALOG_INPUT_TEST_ID } from "./testIds"

export interface PromptTextFieldProps {
  /** Accessible name of the field. The prompt's message, which is already visible above it. */
  label: string
  value: string
  /** Shown under the field and marks it invalid; `null` while the value is acceptable. */
  errorMessage: string | null
  onChange: (value: string) => void
  onSubmit: () => void
}

const FIELD_SIZE = "md"
const ENTER_KEY = "Enter"

/**
 * The text input a `prompt` renders when the caller supplies no custom body.
 *
 * Labelled by `aria-label` rather than a visible `<label>`: the prompt's message is already
 * rendered above the field, and a floating label would repeat it.
 */
export const PromptTextField: React.FC<PromptTextFieldProps> = ({
  label,
  value,
  errorMessage,
  onChange,
  onSubmit,
}) => {
  const inputRef = React.useRef<HTMLInputElement>(null)
  const isInvalid = errorMessage !== null
  const { inputProps, errorMessageProps } = useTextField(
    { "aria-label": label, value, isInvalid, errorMessage: errorMessage ?? undefined, onChange },
    inputRef,
  )

  const mergedInputProps = mergeProps(inputProps, {
    onKeyDown: (event: React.KeyboardEvent<HTMLInputElement>) => {
      if (event.key === ENTER_KEY) {
        event.preventDefault()
        onSubmit()
      }
    },
  })

  return (
    <div className={fieldRootCss}>
      <div className={fieldControlCss} data-field-control="true">
        <input
          {...mergedInputProps}
          ref={inputRef}
          className={resolveInputCss(FIELD_SIZE)}
          data-testid={PROMPT_DIALOG_INPUT_TEST_ID}
        />
      </div>
      {isInvalid && (
        <p {...errorMessageProps} role="alert" className={resolveMessageCss(FIELD_SIZE, true)}>
          {errorMessage}
        </p>
      )}
    </div>
  )
}
