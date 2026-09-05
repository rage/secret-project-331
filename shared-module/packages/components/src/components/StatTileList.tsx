"use client"

import { css } from "@emotion/css"
import React from "react"

export interface StatTileListProps {
  children: React.ReactNode
  /** Accessible name for the list, e.g. "Registration overview". */
  ariaLabel?: string
}

const listCss = css`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(10rem, 1fr));
  gap: var(--space-4);
  margin: 0;
  padding: 0;
  list-style: none;
`

/** Lays out `StatTile` children as an even responsive grid, announced as a list. */
export const StatTileList: React.FC<StatTileListProps> = ({ children, ariaLabel }) => (
  // oxlint-disable-next-line jsx-a11y/no-redundant-roles -- list-style: none makes VoiceOver drop the implicit list role; this restores it
  <ul className={listCss} role="list" aria-label={ariaLabel}>
    {React.Children.map(children, (child, index) => (
      <li key={index}>{child}</li>
    ))}
  </ul>
)
