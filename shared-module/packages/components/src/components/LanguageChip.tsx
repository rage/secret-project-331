"use client"

import { css, cx } from "@emotion/css"
import React from "react"

export interface LanguageChipProps {
  /** Language tag, e.g. `fi-FI`; the chip shows its primary subtag. */
  code: string
  /** Struck through: the item has no version in this language. */
  missing?: boolean
  className?: string
}

const chipCss = css`
  display: inline-flex;
  flex: none;
  justify-content: center;
  min-width: 1.75rem;
  padding: 0 var(--space-2);
  border: 1px solid var(--color-gray-200);
  border-radius: 999px;
  background: var(--color-gray-50);
  font-size: var(--font-size-0);
  font-weight: 600;
  line-height: 1.5;
  color: var(--color-gray-700);
  text-transform: uppercase;
`

const missingCss = css`
  text-decoration: line-through;
`

/** A language as a small chip, e.g. "FI" for `fi-FI`, with the full tag in its title. */
export const LanguageChip: React.FC<LanguageChipProps> = ({ code, missing = false, className }) => (
  <span className={cx(chipCss, missing && missingCss, className)} title={code}>
    {code.split("-")[0] ?? code}
  </span>
)
