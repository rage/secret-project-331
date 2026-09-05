"use client"

import { css, cx } from "@emotion/css"
import React from "react"

export type StatTileListSize = "default" | "compact"

export interface StatTileListProps {
  children: React.ReactNode
  /** Accessible name for the list, e.g. "Registration overview". */
  ariaLabel?: string
  /**
   * Most tiles the row will ever put side by side, whatever the width allows. Past four or five a
   * row of tiles stops being scannable and wants splitting into labelled groups instead.
   */
  maxColumns?: number
  /** `compact` gives tiles a smaller width band, for a secondary row that shouldn't compete with the page's headline numbers. */
  size?: StatTileListSize
}

const DEFAULT_MAX_COLUMNS = 4

const TILE_WIDTH: Record<StatTileListSize, { min: string; max: string; gap: string }> = {
  default: { min: "10rem", max: "18rem", gap: "var(--space-4)" },
  compact: { min: "9rem", max: "13rem", gap: "var(--space-3)" },
}

const listCss = css`
  display: grid;
  margin: 0;
  padding: 0;
  list-style: none;
`

/**
 * Bounds each tile to a comfortable width band and caps the list itself at the width `maxColumns`
 * tiles would take, so a group with fewer tiles than that cannot stretch to fill the row, and a
 * wide viewport cannot squeeze in more columns than intended.
 */
function columnsCss(maxColumns: number, size: StatTileListSize) {
  const { min, max, gap } = TILE_WIDTH[size]
  return css`
    gap: ${gap};
    grid-template-columns: repeat(auto-fill, minmax(${min}, ${max}));
    max-width: calc(${maxColumns} * ${max} + (${maxColumns} - 1) * ${gap});
  `
}

/** Lays out `StatTile` children as an even responsive grid, announced as a list. */
export const StatTileList: React.FC<StatTileListProps> = ({
  children,
  ariaLabel,
  maxColumns = DEFAULT_MAX_COLUMNS,
  size = "default",
}) => (
  // oxlint-disable-next-line jsx-a11y/no-redundant-roles -- list-style: none makes VoiceOver drop the implicit list role; this restores it
  <ul className={cx(listCss, columnsCss(maxColumns, size))} role="list" aria-label={ariaLabel}>
    {React.Children.map(children, (child, index) => (
      <li key={index}>{child}</li>
    ))}
  </ul>
)
