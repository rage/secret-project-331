"use client"

import React from "react"

import {
  SegmentedDateInputField,
  type SegmentedFieldCommonProps,
} from "./primitives/SegmentedDateInputField"

export type TimeFieldProps = SegmentedFieldCommonProps & {
  min?: string
  max?: string
  step?: React.ComponentPropsWithoutRef<"input">["step"]
  hourCycle?: 12 | 24
}

// eslint-disable-next-line i18next/no-literal-string
const floatingLayout = "floating" as const
// eslint-disable-next-line i18next/no-literal-string
const timeFieldKind = "time" as const

export const TimeField = React.forwardRef<HTMLDivElement, TimeFieldProps>(
  function TimeField(props, forwardedRef) {
    return (
      <SegmentedDateInputField
        {...props}
        ref={forwardedRef}
        kind={timeFieldKind}
        layout={floatingLayout}
      />
    )
  },
)
