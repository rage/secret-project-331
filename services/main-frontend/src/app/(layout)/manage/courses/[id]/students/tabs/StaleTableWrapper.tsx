"use client"

import { cx } from "@emotion/css"
import React from "react"

import { staleTableCss, tableScrollCss } from "../studentsTableStyles"

/**
 * The students table's own box: it scrolls sideways when the table is wider than the tab, and dims
 * while deferred data is stale so the previous rows stay visible instead of flashing during a
 * search/sort/page change.
 *
 * `data-students-horizontal-scroll` is what `StudentsTable` resolves its scroller by; the nearest
 * one wins, so the layout's outer scroller no longer carries a whole tab sideways.
 */
export const StaleTableWrapper: React.FC<{ isStale: boolean; children: React.ReactNode }> = ({
  isStale,
  children,
}) => (
  <div className={cx(tableScrollCss, isStale && staleTableCss)} data-students-horizontal-scroll>
    {children}
  </div>
)
