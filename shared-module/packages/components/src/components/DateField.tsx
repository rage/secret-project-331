"use client"

import React from "react"

import { NativeInputField, type NativeInputFieldProps } from "./primitives/NativeInputField"

export type DateFieldProps = NativeInputFieldProps

// eslint-disable-next-line i18next/no-literal-string
const stackedLayout: NativeInputFieldProps["layout"] = "stacked"

export const DateField = React.forwardRef<HTMLInputElement, DateFieldProps>(
  function DateField(props, forwardedRef) {
    return <NativeInputField {...props} ref={forwardedRef} layout={stackedLayout} type="date" />
  },
)
