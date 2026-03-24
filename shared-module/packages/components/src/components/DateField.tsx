"use client"

import React from "react"

import {
  SegmentedDateInputField,
  type SegmentedTemporalFieldProps,
} from "./primitives/SegmentedDateInputField"

export type DateFieldProps = Omit<SegmentedTemporalFieldProps, "layout">

// eslint-disable-next-line i18next/no-literal-string
const stackedLayout = "stacked" as const
// eslint-disable-next-line i18next/no-literal-string
const dateFieldKind = "date" as const

export const DateField = React.forwardRef<HTMLInputElement, DateFieldProps>(
  function DateField(props, forwardedRef) {
    return (
      <SegmentedDateInputField
        {...props}
        ref={forwardedRef}
        kind={dateFieldKind}
        layout={stackedLayout}
      />
    )
  },
)
