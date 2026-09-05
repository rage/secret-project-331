"use client"

import { css, cx } from "@emotion/css"
import React from "react"

interface Props {
  label: string
  count: number
  isSelected: boolean
  onToggle: () => void
}

const chipCss = css`
  display: inline-flex;
  align-items: baseline;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-3-5);
  border: 1px solid var(--color-clear-300);
  border-radius: 999px;
  background: var(--color-clear-50);
  color: var(--color-gray-700);
  font-size: var(--font-size-1);
  font-weight: 500;
  line-height: 1.2;
  cursor: pointer;

  &:hover {
    border-color: var(--color-gray-300);
  }

  &:focus-visible {
    outline: var(--focus-ring-width) solid var(--focus-ring-color);
    outline-offset: var(--focus-ring-offset);
  }
`

// Three cues at once, because a facet row is read by scanning: fill, border weight and type weight.
const selectedChipCss = css`
  border-color: var(--color-blue-600);
  box-shadow: inset 0 0 0 1px var(--color-blue-600);
  background: var(--color-blue-50);
  color: var(--color-blue-800);
  font-weight: 700;

  &:hover {
    border-color: var(--color-blue-700);
  }
`

const countCss = css`
  color: var(--color-gray-500);
  font-variant-numeric: tabular-nums;
  font-weight: 500;
`

const selectedCountCss = css`
  color: var(--color-blue-700);
`

/**
 * One value of a multi-select facet, with how many rows carry it. `count` is over the whole
 * collection rather than the current page, so the chips keep saying what each would select.
 */
const FacetChip: React.FC<Props> = ({ label, count, isSelected, onToggle }) => (
  <button
    type="button"
    className={cx(chipCss, isSelected && selectedChipCss)}
    aria-pressed={isSelected}
    onClick={onToggle}
  >
    <span>{label}</span>
    <span className={cx(countCss, isSelected && selectedCountCss)}>{count}</span>
  </button>
)

export default FacetChip
