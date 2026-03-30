"use client"

import { datePickerButtonIconCss } from "./segmentedDateInputFieldStyles"

/** Calendar glyph for the date picker trigger. */
export function CalendarIcon() {
  return (
    <svg
      aria-hidden="true"
      className={datePickerButtonIconCss}
      fill="none"
      viewBox="0 0 20 20"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect height="13" rx="2.5" stroke="currentColor" strokeWidth="1.5" width="15" x="2.5" y="4" />
      <path
        d="M6 2.5v3M14 2.5v3M2.5 8h15"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.5"
      />
    </svg>
  )
}
