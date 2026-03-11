"use client"

import React from "react"

import { NativeInputField, type NativeInputFieldProps } from "./primitives/NativeInputField"

export type DateTimeLocalFieldProps = NativeInputFieldProps

// eslint-disable-next-line i18next/no-literal-string
const stackedLayout: NativeInputFieldProps["layout"] = "stacked"

export const DateTimeLocalField = React.forwardRef<HTMLInputElement, DateTimeLocalFieldProps>(
  function DateTimeLocalField(props, forwardedRef) {
    return (
      <NativeInputField
        {...props}
        ref={forwardedRef}
        layout={stackedLayout}
        type="datetime-local"
      />
    )
  },
)
