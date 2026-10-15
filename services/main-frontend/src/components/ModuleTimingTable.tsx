"use client"

import { css } from "@emotion/css"
import type { TFunction } from "i18next"

import { dateToString } from "@/shared-module/common/utils/time"
import type { TableColumn } from "@/shared-module/components"
import { formatDuration, type ModuleRow } from "@/utils/moduleTimeline"

// Table glyphs (SCREAMING_CASE keeps them out of the i18next literal-string lint).
const STAR = "★"
const EMPTY_CELL = "—"

export const moduleTimingLegendCss = css`
  margin: 0.25rem 0 0;
  color: var(--color-gray-500, #535a66);
  font-size: 0.85rem;
`

const formatStarted = (row: ModuleRow): string =>
  row.startedAt ? `${row.isBase ? `${STAR} ` : ""}${dateToString(row.startedAt)}` : EMPTY_CELL

/** The five per-module columns shared by both activity timelines; callers may prepend their own, such as a course column. */
export function moduleTimingColumns(t: TFunction): TableColumn<ModuleRow>[] {
  return [
    { header: t("label-module"), cell: (row) => row.name ?? t("default-module") },
    { header: t("label-started"), cell: formatStarted },
    {
      header: t("label-completed"),
      cell: (row) => {
        if (!row.completedAt) {
          return EMPTY_CELL
        }
        return row.needsReview
          ? t("completed-review", { date: dateToString(row.completedAt) })
          : dateToString(row.completedAt)
      },
    },
    {
      header: t("label-time-in-module"),
      cell: (row) => {
        if (row.moduleSeconds !== null) {
          return formatDuration(row.moduleSeconds, t)
        }
        return row.startedAt ? t("in-progress") : EMPTY_CELL
      },
    },
    {
      header: t("label-since-enrolled"),
      cell: (row) =>
        row.sinceEnrollSeconds !== null ? formatDuration(row.sinceEnrollSeconds, t) : EMPTY_CELL,
    },
  ]
}
