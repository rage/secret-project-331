"use client"

import { css, cx } from "@emotion/css"
import React from "react"

const partsCss = css`
  display: inline-flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 0 var(--space-3);
`

/** Short values side by side, set apart by space rather than a separator glyph; empty ones left out. */
const InlineParts: React.FC<{
  parts: React.ReactNode[]
  className?: string | undefined
}> = ({ parts, className }) => (
  <span className={cx(partsCss, className)}>
    {parts
      .filter((part) => part !== null && part !== undefined && part !== false && part !== "")
      .map((part, index) => (
        <span key={index}>{part}</span>
      ))}
  </span>
)

export default InlineParts
