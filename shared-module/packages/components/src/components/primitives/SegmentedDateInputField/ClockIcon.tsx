"use client"

import { datePickerButtonIconCss } from "./segmentedDateInputFieldStyles"

/** Clock glyph for the time picker trigger. */
export function ClockIcon() {
  return (
    <svg
      aria-hidden="true"
      className={datePickerButtonIconCss}
      fill="none"
      viewBox="0 0 20 20"
      xmlns="http://www.w3.org/2000/svg"
    >
      <circle cx="10" cy="10" r="7.5" stroke="currentColor" strokeWidth="1.5" />
      <path d="M10 6v4l2.5 2.5" stroke="currentColor" strokeLinecap="round" strokeWidth="1.5" />
    </svg>
  )
}
