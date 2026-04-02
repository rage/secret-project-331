"use client"

import React from "react"

import {
  SegmentedDateInputField,
  type SegmentedFieldCommonProps,
} from "./primitives/SegmentedDateInputField"

export type DateFieldProps = SegmentedFieldCommonProps & {
  min?: string
  max?: string
}

// eslint-disable-next-line i18next/no-literal-string
const floatingLayout = "floating" as const
// eslint-disable-next-line i18next/no-literal-string
const dateFieldKind = "date" as const

export const DateField = React.forwardRef<HTMLDivElement, DateFieldProps>(
  function DateField(props, forwardedRef) {
    return (
      <SegmentedDateInputField
        {...props}
        ref={forwardedRef}
        kind={dateFieldKind}
        layout={floatingLayout}
      />
    )
  },
)
