"use client"

import { css, cx } from "@emotion/css"
import React from "react"

export interface StatTileListProps {
  children: React.ReactNode
  /** Accessible name for the list, e.g. "Registration overview". */
  ariaLabel?: string
  className?: string
}

const listCss = css`
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-4);
  margin: 0;
  padding: 0;
  list-style: none;
`

/** Lays out `StatTile` children as a responsive row, announced as a list. */
export const StatTileList: React.FC<StatTileListProps> = ({ children, ariaLabel, className }) => (
  // oxlint-disable-next-line jsx-a11y/no-redundant-roles -- list-style: none makes VoiceOver drop the implicit list role; this restores it
  <ul className={cx(listCss, className)} role="list" aria-label={ariaLabel}>
    {React.Children.map(children, (child, index) => (
      <li key={index}>{child}</li>
    ))}
  </ul>
)
