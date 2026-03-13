"use client"

import React from "react"

import {
  SegmentedDateInputField,
  type SegmentedTemporalFieldProps,
} from "./primitives/SegmentedDateInputField"

export type TimeFieldProps = SegmentedTemporalFieldProps

// eslint-disable-next-line i18next/no-literal-string
const stackedLayout: TimeFieldProps["layout"] = "stacked"
// eslint-disable-next-line i18next/no-literal-string
const timeFieldKind = "time" as const

export const TimeField = React.forwardRef<HTMLInputElement, TimeFieldProps>(
  function TimeField(props, forwardedRef) {
    return (
      <SegmentedDateInputField
        {...props}
        ref={forwardedRef}
        kind={timeFieldKind}
        layout={stackedLayout}
      />
    )
  },
)
