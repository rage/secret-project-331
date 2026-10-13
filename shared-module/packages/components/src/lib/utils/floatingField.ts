import type React from "react"
import { VisuallyHidden } from "react-aria"

export function hasTextControlValue(value: unknown): boolean {
  if (value === null || value === undefined) {
    return false
  }

  return String(value).length > 0
}

export function shouldFloatLabel(isFocused: boolean, hasValue: boolean): boolean {
  return isFocused || hasValue
}

/** True when `label` is wrapped in `<VisuallyHidden>`, so the field has no visible label to float. */
export function isVisuallyHiddenLabel(label: React.ReactNode): boolean {
  return (
    typeof label === "object" && label !== null && "type" in label && label.type === VisuallyHidden
  )
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
