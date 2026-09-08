"use client"

import { useEffect, useState } from "react"

import { renderErrorForSpec } from "./validateChartSpec"

// Long enough that a spec being typed isn't recompiled per keystroke, nor flagged as broken while
// it is still half-written.
const RENDER_VALIDATION_DEBOUNCE_MS = 300

/**
 * Why the spec won't render, or null when it will, re-checked once editing pauses.
 *
 * Drives the error the teacher is shown and the "fix with AI" offer that goes with it.
 */
export const useChartRenderError = (spec: string | undefined): string | null => {
  const [renderError, setRenderError] = useState<string | null>(null)

  useEffect(() => {
    const timeout = setTimeout(() => {
      setRenderError(spec?.trim() ? renderErrorForSpec(spec) : null)
    }, RENDER_VALIDATION_DEBOUNCE_MS)
    return () => clearTimeout(timeout)
  }, [spec])

  return renderError
}
