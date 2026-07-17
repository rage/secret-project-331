"use client"

import { css } from "@emotion/css"
import React from "react"
import { useTranslation } from "react-i18next"

import { dateToString } from "@/shared-module/common/utils/time"
import { formatDuration, type ModuleRow } from "@/utils/moduleTimeline"

// Table glyphs (SCREAMING_CASE keeps them out of the i18next literal-string lint).
const STAR = "★"
const EMPTY_CELL = "—"

/** Shared styles for the per-module timing tables in the cross-course and per-course activity timelines. */
export const moduleTimingTableCss = css`
  width: 100%;
  border-collapse: collapse;
  font-size: 15px;

  th,
  td {
    text-align: left;
    padding: 0.4rem 0.6rem;
    border-bottom: 1px solid var(--color-clear-300, #e2e4e6);
  }

  th {
    color: var(--color-gray-500, #535a66);
    font-weight: 600;
  }

  td {
    color: var(--color-gray-700, #1a2333);
    font-variant-numeric: tabular-nums;
  }
`

export const moduleTimingLegendCss = css`
  margin: 0.25rem 0 0;
  color: var(--color-gray-500, #535a66);
  font-size: 0.85rem;
`

export const moduleTimingCaptionCss = css`
  text-align: left;
  color: var(--color-gray-500, #535a66);
  padding: 0.25rem 0;
`

/**
 * The five per-module cells (module, started, completed, time-in-module, since-enrolled) shared by both
 * activity-timeline tables. Callers wrap these in their own `<tr>` and may prepend a course cell.
 */
export const ModuleTimingCells: React.FC<{ row: ModuleRow }> = ({ row }) => {
  const { t } = useTranslation()
  return (
    <>
      <td>{row.name ?? t("default-module")}</td>
      <td>
        {row.startedAt ? (
          <>
            {row.isBase ? `${STAR} ` : ""}
            {dateToString(row.startedAt)}
          </>
        ) : (
          EMPTY_CELL
        )}
      </td>
      <td>
        {row.completedAt
          ? row.needsReview
            ? t("completed-review", { date: dateToString(row.completedAt) })
            : dateToString(row.completedAt)
          : EMPTY_CELL}
      </td>
      <td>
        {row.moduleSeconds !== null
          ? formatDuration(row.moduleSeconds, t)
          : row.startedAt
            ? t("in-progress")
            : EMPTY_CELL}
      </td>
      <td>
        {row.sinceEnrollSeconds !== null ? formatDuration(row.sinceEnrollSeconds, t) : EMPTY_CELL}
      </td>
    </>
  )
}
