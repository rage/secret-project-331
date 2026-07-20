"use client"

import React from "react"
import { useButton } from "react-aria"

import { ChevronIcon } from "./ChevronIcon"
import { calendarNavButtonCss } from "./datePickerCalendarStyles"

/** Icon button for paging the calendar by month or year range. */
export function CalendarNavButton({
  direction,
  isDisabled,
  label,
  onPress,
}: {
  direction: "left" | "right"
  isDisabled: boolean
  label: string
  onPress: () => void
}) {
  const ref = React.useRef<HTMLButtonElement>(null)
  const { buttonProps } = useButton(
    {
      "aria-label": label,
      isDisabled,
      onPress,
    },
    ref,
  )

  return (
    <button {...buttonProps} ref={ref} className={calendarNavButtonCss} type="button">
      <ChevronIcon direction={direction} />
    </button>
  )
}
