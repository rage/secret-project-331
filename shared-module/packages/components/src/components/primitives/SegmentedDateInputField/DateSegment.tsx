"use client"

import { cx } from "@emotion/css"
import type { DateFieldState } from "@react-stately/datepicker"
import { useRef } from "react"
import { mergeProps, useDateSegment, useFocusRing } from "react-aria"

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
  // Native `:focus-visible` is decided per-element by browser heuristics, which drift out of
  // sync with the group-level `isFocused` tracked via useFocusWithin (e.g. Safari showing it
  // for pointer focus, or it lingering across a focus transfer the group already considers
  // blurred). useFocusRing shares react-aria's own focus-visible tracking, so the ring agrees
  // with the rest of the field's focus state.
  const { focusProps, isFocusVisible } = useFocusRing()

  return (
    <div
      {...mergeProps(segmentProps, focusProps)}
      ref={ref}
      className={cx(
        segmentCss,
        segment.isPlaceholder ? segmentPlaceholderCss : undefined,
        segment.type === "literal" ? segmentLiteralCss : undefined,
      )}
      data-focus-visible={isFocusVisible ? "true" : "false"}
    >
      {segment.text}
    </div>
  )
}
