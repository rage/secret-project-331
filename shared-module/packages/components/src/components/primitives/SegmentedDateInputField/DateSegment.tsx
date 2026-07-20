"use client"

import { cx } from "@emotion/css"
import type { DateFieldState } from "@react-stately/datepicker"
import { useRef } from "react"
import { useDateSegment } from "react-aria"

import {
  segmentCss,
  segmentLiteralCss,
  segmentPlaceholderCss,
} from "./segmentedDateInputFieldStyles"

/** One editable or literal date/time segment in the segmented control. */
export function DateSegment({
  segment,
  state,
}: {
  segment: DateFieldState["segments"][number]
  state: DateFieldState
}) {
  const ref = useRef<HTMLDivElement>(null)
  const { segmentProps } = useDateSegment(segment, state, ref)

  return (
    <div
      {...segmentProps}
      ref={ref}
      className={cx(
        segmentCss,
        segment.isPlaceholder ? segmentPlaceholderCss : undefined,
        segment.type === "literal" ? segmentLiteralCss : undefined,
      )}
    >
      {segment.text}
    </div>
  )
}
