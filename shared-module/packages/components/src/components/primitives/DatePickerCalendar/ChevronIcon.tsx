"use client"

import { calendarNavIconCss } from "./datePickerCalendarStyles"

/** Chevron glyph for prev/next navigation in the date picker. */
export function ChevronIcon({ direction }: { direction: "left" | "right" }) {
  return (
    <svg
      aria-hidden="true"
      className={calendarNavIconCss}
      fill="none"
      viewBox="0 0 12 12"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d={direction === "left" ? "M7.5 2.25L3.75 6l3.75 3.75" : "M4.5 2.25L8.25 6 4.5 9.75"}
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.5"
      />
    </svg>
  )
}
