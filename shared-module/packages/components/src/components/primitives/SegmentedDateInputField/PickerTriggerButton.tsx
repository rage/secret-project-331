"use client"

import { cx } from "@emotion/css"
import type React from "react"
import { useRef } from "react"
import type { AriaButtonProps } from "react-aria"
import { useButton } from "react-aria"

import { datePickerButtonCss, segmentedPickerTriggerCss } from "./segmentedDateInputFieldStyles"

/** Icon button at the trailing edge of a segmented field that opens its picker popover. */
export function PickerTriggerButton({
  buttonProps,
  dataTestId,
  icon,
}: {
  buttonProps: AriaButtonProps
  dataTestId?: string | undefined
  icon: React.ReactNode
}) {
  const ref = useRef<HTMLButtonElement>(null)
  const { buttonProps: triggerProps } = useButton(buttonProps, ref)

  return (
    <button
      {...triggerProps}
      ref={ref}
      className={cx(datePickerButtonCss, segmentedPickerTriggerCss)}
      data-testid={dataTestId}
      type="button"
    >
      {icon}
    </button>
  )
}
