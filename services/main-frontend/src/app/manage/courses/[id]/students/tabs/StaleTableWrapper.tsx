"use client"

import React from "react"

import { staleTableCss } from "../studentsTableStyles"

/**
 * Dims the students table while its deferred data is stale (a transition is pending), so the previous
 * rows stay visible instead of flashing during a search/sort/page change. Shared by every students
 * subtab so the stale-state markup lives in one place and can't drift between tabs.
 */
export const StaleTableWrapper: React.FC<{ isStale: boolean; children: React.ReactNode }> = ({
  isStale,
  children,
}) => <div className={isStale ? staleTableCss : undefined}>{children}</div>
