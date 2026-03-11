"use client"

import React from "react"

import { type NativeInputFieldProps } from "./primitives/NativeInputField"
import { SegmentedDateInputField } from "./primitives/SegmentedDateInputField"

export type DateFieldProps = NativeInputFieldProps

// eslint-disable-next-line i18next/no-literal-string
const stackedLayout: NativeInputFieldProps["layout"] = "stacked"
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
