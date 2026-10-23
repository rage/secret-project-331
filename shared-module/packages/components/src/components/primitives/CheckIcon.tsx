"use client"

import { css, cx } from "@emotion/css"

const checkCss = css`
  width: 1em;
  height: 1em;
  flex: none;
`

/** Check mark glyph in `currentColor`, sized to the text unless `className` says otherwise. */
export function CheckIcon({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={cx(checkCss, className)}
      fill="none"
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="m4.5 12 4.77 4.77L19.5 6.55" stroke="currentColor" strokeWidth="2.5" />
    </svg>
  )
}
