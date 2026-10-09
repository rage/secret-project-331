"use client"

import { css } from "@emotion/css"
import React from "react"

// What `formatZonedTimestamp` and `formatZonedTimeRange` print, and an email address.
const VALUE_PATTERN =
  /(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}(?:–(?:\d{4}-\d{2}-\d{2} )?\d{2}:\d{2}:\d{2})? \(UTC[+-]\d{1,2}(?::\d{2})?\)|[^\s@]+@[^\s@]+\.[^\s@.,;:)]+)/

const nowrapCss = css`
  white-space: nowrap;
`

/**
 * Text with the timestamps and email addresses in it kept whole: a timestamp never wraps, and an
 * address breaks only before its `@`.
 */
const UnbrokenValuesText: React.FC<{ children: string }> = ({ children }) => (
  <>
    {children.split(VALUE_PATTERN).map((part, index) => {
      if (index % 2 === 0) {
        return part
      }
      const at = part.indexOf("@")
      if (at > 0 && !/^\d{4}-/.test(part)) {
        return (
          <React.Fragment key={index}>
            <span className={nowrapCss}>{part.slice(0, at)}</span>
            <wbr />
            <span className={nowrapCss}>{part.slice(at)}</span>
          </React.Fragment>
        )
      }
      return (
        <span key={index} className={nowrapCss}>
          {part}
        </span>
      )
    })}
  </>
)

export default UnbrokenValuesText
