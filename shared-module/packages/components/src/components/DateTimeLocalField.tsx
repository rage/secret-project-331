"use client"

import React from "react"

import {
  SegmentedDateInputField,
  type SegmentedTemporalFieldProps,
} from "./primitives/SegmentedDateInputField"

export type DateTimeLocalFieldProps = Omit<SegmentedTemporalFieldProps, "layout">

// eslint-disable-next-line i18next/no-literal-string
const stackedLayout: DateTimeLocalFieldProps["layout"] = "stacked"
// eslint-disable-next-line i18next/no-literal-string
const dateTimeFieldKind = "datetime" as const

export const DateTimeLocalField = React.forwardRef<HTMLInputElement, DateTimeLocalFieldProps>(
  function DateTimeLocalField(props, forwardedRef) {
    return (
      <SegmentedDateInputField
        {...props}
        ref={forwardedRef}
        kind={dateTimeFieldKind}
        layout={stackedLayout}
      />
    )
  },
)
