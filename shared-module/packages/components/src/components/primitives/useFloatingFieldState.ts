"use client"

import React from "react"

import { hasTextControlValue, shouldFloatLabel } from "../../lib/utils/floatingField"

type SupportedElement = HTMLInputElement | HTMLTextAreaElement

export function useFloatingFieldState<T extends SupportedElement>({
  defaultValue,
  elementRef,
  value,
}: {
  defaultValue: string | undefined
  elementRef: React.RefObject<T | null>
  value: string | undefined
}) {
  const [isFocused, setIsFocused] = React.useState(false)
  const [hasValue, setHasValue] = React.useState(
    () => hasTextControlValue(value) || hasTextControlValue(defaultValue),
  )

  React.useEffect(() => {
    if (value !== undefined) {
      setHasValue(hasTextControlValue(value))
      return
    }

    if (elementRef.current) {
      setHasValue(elementRef.current.value.length > 0)
      return
    }

    setHasValue(hasTextControlValue(defaultValue))
  }, [defaultValue, elementRef, value])

  return {
    hasValue,
    isFocused,
    isFloated: shouldFloatLabel(isFocused, hasValue),
    setHasValue,
    setIsFocused,
  }
}
