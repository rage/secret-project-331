import type React from "react"

import { joinAriaDescribedBy } from "./aria"

type ResolveFieldStateInput = {
  disabled?: boolean
  readOnly?: boolean
  required?: boolean
  isDisabled?: boolean
  isReadOnly?: boolean
  isRequired?: boolean
  isInvalid?: boolean
  ariaInvalid?: React.AriaAttributes["aria-invalid"]
  errorMessage?: React.ReactNode
}

type ResolveDescribedByInput = {
  ariaDescribedBy?: string
  descriptionId?: string
  noticeId?: string
  errorMessageId?: string
  hasDescription?: boolean
  hasNotice?: boolean
  hasErrorMessage?: boolean
}

export function resolveFieldState({
  disabled,
  readOnly,
  required,
  isDisabled,
  isReadOnly,
  isRequired,
  isInvalid,
  ariaInvalid,
  errorMessage,
}: ResolveFieldStateInput) {
  const resolvedInvalidFromAria =
    ariaInvalid == null
      ? undefined
      : ariaInvalid === true ||
        ariaInvalid === "true" ||
        ariaInvalid === "grammar" ||
        ariaInvalid === "spelling"

  return {
    isDisabled: isDisabled ?? disabled ?? false,
    isReadOnly: isReadOnly ?? readOnly ?? false,
    isRequired: isRequired ?? required ?? false,
    isInvalid: isInvalid ?? resolvedInvalidFromAria ?? Boolean(errorMessage),
  }
}

export function resolveFieldDescribedBy({
  ariaDescribedBy,
  descriptionId,
  noticeId,
  errorMessageId,
  hasDescription,
  hasNotice,
  hasErrorMessage,
}: ResolveDescribedByInput) {
  return joinAriaDescribedBy(
    ariaDescribedBy,
    hasDescription ? descriptionId : undefined,
    hasNotice ? noticeId : undefined,
    hasErrorMessage ? errorMessageId : undefined,
  )
}

export function hasFieldValue(value: unknown) {
  if (value == null) {
    return false
  }

  if (Array.isArray(value)) {
    return value.length > 0
  }

  if (typeof value === "string") {
    return value.length > 0
  }

  return true
}

export function toInputValue(value: unknown) {
  if (value == null) {
    return ""
  }

  return typeof value === "string" ? value : String(value)
}

export { joinAriaDescribedBy }
