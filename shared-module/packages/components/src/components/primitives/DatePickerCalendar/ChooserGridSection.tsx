"use client"

import { cx } from "@emotion/css"
import React, { useId } from "react"

import {
  chooserGridCss,
  chooserGridOptionCss,
  chooserGridOptionSelectedCss,
  chooserSectionCss,
  chooserSectionHeaderCss,
  chooserSectionLabelCss,
} from "./datePickerCalendarStyles"
import type { ChooserGridOption } from "./datePickerCalendarTypes"

/** Renders a titled grid of month or year choices in the picker overlay. */
export function ChooserGridSection({
  isDisabled,
  label,
  options,
  pager,
}: {
  isDisabled: boolean
  label?: string
  options: ChooserGridOption[]
  pager?: React.ReactNode
}) {
  const labelId = useId()
  const selectedIndex = options.findIndex((option) => option.isSelected)
  const defaultIndex = selectedIndex >= 0 ? selectedIndex : 0

  return (
    <div className={chooserSectionCss}>
      {label || pager ? (
        <div className={chooserSectionHeaderCss}>
          {label ? (
            <span id={labelId} className={chooserSectionLabelCss}>
              {label}
            </span>
          ) : null}
          {pager}
        </div>
      ) : null}
      <div aria-labelledby={label ? labelId : undefined} className={chooserGridCss} role="group">
        {options.map((option, index) => (
          <button
            key={option.id}
            aria-pressed={option.isSelected}
            className={cx(
              chooserGridOptionCss,
              option.isSelected ? chooserGridOptionSelectedCss : undefined,
            )}
            data-selected={option.isSelected ? "true" : "false"}
            disabled={isDisabled}
            tabIndex={index === defaultIndex ? 0 : -1}
            type="button"
            onClick={option.onSelect}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  )
}
