"use client"

import React from "react"

import { NativeInputField, type NativeInputFieldProps } from "./primitives/NativeInputField"

export type TimeFieldProps = NativeInputFieldProps

// eslint-disable-next-line i18next/no-literal-string
const stackedLayout: NativeInputFieldProps["layout"] = "stacked"

export const TimeField = React.forwardRef<HTMLInputElement, TimeFieldProps>(
  function TimeField(props, forwardedRef) {
    return <NativeInputField {...props} ref={forwardedRef} layout={stackedLayout} type="time" />
  },
)
