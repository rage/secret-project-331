"use client"

import { cx } from "@emotion/css"
import React from "react"
import type { AriaDialogProps } from "react-aria"
import { useDialog } from "react-aria"

import {
  dialogCss,
  pickerLayoutCss,
  pickerRootCss,
  standaloneTimePanelCss,
} from "./datePickerCalendarStyles"
import type { DatePickerTimeSelectorProps } from "./datePickerCalendarTypes"
import { HybridTimeSelector } from "./HybridTimeSelector"

/** Popover body for the time field: the time selector on its own, focused on open. */
export function TimePickerDialog({
  dialogProps,
  timeSelectorProps,
}: {
  dialogProps: AriaDialogProps
  timeSelectorProps: DatePickerTimeSelectorProps
}) {
  const ref = React.useRef<HTMLDivElement>(null)
  const { dialogProps: resolvedDialogProps } = useDialog(dialogProps, ref)

  return (
    <div {...resolvedDialogProps} ref={ref} className={cx(dialogCss, pickerRootCss)}>
      <div className={pickerLayoutCss}>
        <HybridTimeSelector
          shouldFocusOnMount
          className={standaloneTimePanelCss}
          timeSelectorProps={timeSelectorProps}
        />
      </div>
    </div>
  )
}
