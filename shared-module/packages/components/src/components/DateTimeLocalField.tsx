"use client"

import React from "react"

import {
  SegmentedDateInputField,
  type SegmentedFieldCommonProps,
} from "./primitives/SegmentedDateInputField"

export type DateTimeLocalFieldProps = SegmentedFieldCommonProps & {
  min?: string
  max?: string
  step?: React.ComponentPropsWithoutRef<"input">["step"]
  hourCycle?: 12 | 24
}

// eslint-disable-next-line i18next/no-literal-string
const floatingLayout = "floating" as const
// eslint-disable-next-line i18next/no-literal-string
const dateTimeFieldKind = "datetime" as const

export const DateTimeLocalField = React.forwardRef<HTMLDivElement, DateTimeLocalFieldProps>(
  function DateTimeLocalField(props, forwardedRef) {
    return (
      <SegmentedDateInputField
        {...props}
        ref={forwardedRef}
        kind={dateTimeFieldKind}
        layout={floatingLayout}
      />
    )
  },
)
