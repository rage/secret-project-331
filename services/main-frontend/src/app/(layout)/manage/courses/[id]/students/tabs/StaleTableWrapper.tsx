"use client"

import { cx } from "@emotion/css"
import React from "react"
import { useTranslation } from "react-i18next"

import { ScrollRegion } from "@/shared-module/components"

import { staleTableCss, tableScrollCss } from "../studentsTableStyles"

/**
 * The students table's own box: it scrolls sideways when the table is wider than the tab, and dims
 * while deferred data is stale so the previous rows stay visible instead of flashing during a
 * search/sort/page change.
 *
 * `data-students-horizontal-scroll` is what `StudentsTable` resolves its scroller by.
 */
export const StaleTableWrapper: React.FC<{ isStale: boolean; children: React.ReactNode }> = ({
  isStale,
  children,
}) => {
  const { t } = useTranslation()
  return (
    <ScrollRegion
      className={cx(tableScrollCss, isStale && staleTableCss)}
      data-students-horizontal-scroll
      label={t("label-students")}
    >
      {children}
    </ScrollRegion>
  )
}
