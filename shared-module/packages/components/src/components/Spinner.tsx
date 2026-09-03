"use client"

import { cx } from "@emotion/css"
import React from "react"

import { useLoadingAffordance } from "../lib/utils/loading"
import { LOADING_AFFORDANCE_DELAY_MS } from "../styles/motion"
import { SPINNER_TEST_ID } from "./loadingTestIds"
import { spinnerGlyphCss, type SpinnerSize, type SpinnerTone } from "./primitives/spinnerStyles"

export interface SpinnerProps {
  size?: SpinnerSize
  tone?: SpinnerTone
  /**
   * Accessible name. Omit — the default — for a decorative spinner: it stays `aria-hidden` and
   * silent, and the surrounding region, button, or adjacent text owns the announcement. Passing
   * it wraps the glyph in `role="status" aria-live="polite"`, announcing once on appearance.
   */
  label?: string
  /** Suppress rendering for this long after mount. Default `LOADING_AFFORDANCE_DELAY_MS`; 0 shows immediately. */
  delayMs?: number
  className?: string
  "data-testid"?: string | undefined
}

/** A small indeterminate loading glyph with no margin of its own; the caller owns placement. */
export const Spinner: React.FC<SpinnerProps> = ({
  size = "md",
  tone = "accent",
  label,
  delayMs = LOADING_AFFORDANCE_DELAY_MS,
  className,
  "data-testid": dataTestId = SPINNER_TEST_ID,
}) => {
  const isVisible = useLoadingAffordance(true, { delayMs })

  if (!isVisible) {
    return null
  }

  const glyphCss = spinnerGlyphCss(size, tone)

  if (!label) {
    return <span className={cx(glyphCss, className)} data-testid={dataTestId} aria-hidden="true" />
  }

  return (
    // role="status" takes its name from aria-label only ("name from author", not content), so the
    // label can't be a VisuallyHidden child; it has to sit directly on this element.
    // oxlint-disable-next-line jsx-a11y/prefer-tag-over-role -- styled span role=status; <output> changes styling
    <span
      role="status"
      aria-live="polite"
      aria-label={label}
      className={className}
      data-testid={dataTestId}
    >
      <span className={glyphCss} aria-hidden="true" />
    </span>
  )
}
