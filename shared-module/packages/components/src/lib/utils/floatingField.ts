import type React from "react"

export function hasTextControlValue(value: unknown): boolean {
  if (value == null) {
    return false
  }

  return String(value).length > 0
}

export function shouldFloatLabel(isFocused: boolean, hasValue: boolean): boolean {
  return isFocused || hasValue
}

export function resolveFloatingPlaceholder(placeholder?: string): string {
  return placeholder ?? " "
}

export function resolveRenderedErrorMessage(
  errorMessage: React.ReactNode | undefined,
  isInvalid: boolean,
  validationErrors: readonly string[],
): React.ReactNode | null {
  if (errorMessage !== undefined) {
    return errorMessage
  }

  if (!isInvalid || validationErrors.length === 0) {
    return null
  }

  return validationErrors.join(" ")
}
