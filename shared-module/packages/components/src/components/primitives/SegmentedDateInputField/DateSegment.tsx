"use client"

import { cx } from "@emotion/css"
import type { DateFieldState } from "@react-stately/datepicker"
import { useRef } from "react"
import { mergeProps, useDateSegment, useFocusRing } from "react-aria"

import {
  segmentCss,
  segmentEditableCss,
  segmentLiteralCss,
  segmentPlaceholderCss,
} from "./segmentedDateInputFieldStyles"

// Finnish joins date and time with " klo "; the field shows the plain space between them instead.
// oxlint-disable-next-line i18next/no-literal-string
const finnishDateTimeJoiner = "klo"

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
  const isLiteral = segment.type === "literal"
  const text = isLiteral && segment.text.trim() === finnishDateTimeJoiner ? " " : segment.text

  return (
    <div
      {...mergeProps(segmentProps, focusProps)}
      ref={ref}
      className={cx(
        segmentCss,
        isLiteral ? segmentLiteralCss : segmentEditableCss,
        segment.isPlaceholder ? segmentPlaceholderCss : undefined,
      )}
      data-focus-visible={isFocusVisible ? "true" : "false"}
    >
      {text}
    </div>
  )
}
