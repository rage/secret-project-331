"use client"

import React from "react"

import { type NativeInputFieldProps } from "./primitives/NativeInputField"
import { SegmentedDateInputField } from "./primitives/SegmentedDateInputField"

export type TimeFieldProps = NativeInputFieldProps

// eslint-disable-next-line i18next/no-literal-string
const stackedLayout: NativeInputFieldProps["layout"] = "stacked"
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
