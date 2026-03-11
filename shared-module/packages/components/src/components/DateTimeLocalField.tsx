"use client"

import React from "react"

import { type NativeInputFieldProps } from "./primitives/NativeInputField"
import { SegmentedDateInputField } from "./primitives/SegmentedDateInputField"

export type DateTimeLocalFieldProps = NativeInputFieldProps

// eslint-disable-next-line i18next/no-literal-string
const stackedLayout: NativeInputFieldProps["layout"] = "stacked"
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
