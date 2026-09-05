"use client"

import { css, cx } from "@emotion/css"

const chevronCss = css`
  width: 1em;
  height: 1em;
`

/** Chevron glyph in `currentColor`, sized to the text unless `className` says otherwise. */
export function ChevronIcon({
  direction,
  className,
}: {
  direction: "left" | "right"
  className?: string
}) {
  return (
    <svg
      aria-hidden="true"
      className={cx(chevronCss, className)}
      fill="none"
      viewBox="0 0 12 12"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d={direction === "left" ? "M7.5 2.25L3.75 6l3.75 3.75" : "M4.5 2.25L8.25 6 4.5 9.75"}
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.5"
      />
    </svg>
  )
}
