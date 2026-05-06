"use client"

import React from "react"

import { DateLikeSegmentedInputField } from "./DateLikeSegmentedInputField"
import { TimeSegmentedInputField } from "./TimeSegmentedInputField"
import type {
  DateLikeFieldProps,
  SegmentedDateInputFieldProps,
  TimeOnlyFieldProps,
} from "./segmentTypes"

export type { SegmentedDateInputFieldProps, SegmentedTemporalFieldProps } from "./segmentTypes"

const ForwardedDateLikeSegmentedInputField = React.forwardRef<HTMLInputElement, DateLikeFieldProps>(
  DateLikeSegmentedInputField,
)

const ForwardedTimeSegmentedInputField = React.forwardRef<HTMLInputElement, TimeOnlyFieldProps>(
  TimeSegmentedInputField,
)

export const SegmentedDateInputField = React.forwardRef<
  HTMLInputElement,
  SegmentedDateInputFieldProps
>(function SegmentedDateInputField(props, forwardedRef) {
  if (props.kind === "time") {
    return (
      <ForwardedTimeSegmentedInputField {...(props as TimeOnlyFieldProps)} ref={forwardedRef} />
    )
  }

  return (
    <ForwardedDateLikeSegmentedInputField {...(props as DateLikeFieldProps)} ref={forwardedRef} />
  )
})
