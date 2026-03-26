"use client"

import { cx } from "@emotion/css"
import { useRef } from "react"
import type { AriaButtonProps } from "react-aria"
import { useButton } from "react-aria"

import { CalendarIcon } from "./CalendarIcon"
import { datePickerButtonCss, segmentedPickerTriggerCss } from "./segmentedDateInputFieldStyles"

/** Calendar affordance wired to the date picker `useDatePicker` button props. */
export function DatePickerTriggerButton({ buttonProps }: { buttonProps: AriaButtonProps }) {
  const ref = useRef<HTMLButtonElement>(null)
  const { buttonProps: triggerProps } = useButton(buttonProps, ref)

  return (
    <button
      {...triggerProps}
      ref={ref}
      className={cx(datePickerButtonCss, segmentedPickerTriggerCss)}
      type="button"
    >
      <CalendarIcon />
    </button>
  )
}
