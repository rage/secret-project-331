"use client"

import React from "react"

import { DateLikeSegmentedInputField } from "./DateLikeSegmentedInputField"
import type {
  DateLikeFieldProps,
  SegmentedDateInputFieldProps,
  TimeOnlyFieldProps,
} from "./segmentTypes"
import { TimeSegmentedInputField } from "./TimeSegmentedInputField"

export type {
  SegmentedDateInputFieldProps,
  SegmentedFieldCommonProps,
  SegmentedTemporalFieldProps,
} from "./segmentTypes"

const ForwardedDateLikeSegmentedInputField = React.forwardRef<HTMLDivElement, DateLikeFieldProps>(
  DateLikeSegmentedInputField,
)

const ForwardedTimeSegmentedInputField = React.forwardRef<HTMLDivElement, TimeOnlyFieldProps>(
  TimeSegmentedInputField,
)

export const SegmentedDateInputField = React.forwardRef<
  HTMLDivElement,
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
