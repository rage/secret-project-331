// ProgressTab.tsx
"use client"

import { css } from "@emotion/css"
import type { ColumnDef } from "@tanstack/react-table"
import React, { useDeferredValue, useMemo } from "react"
import { useTranslation } from "react-i18next"

import ErrorBanner from "@/shared-module/common/components/ErrorBanner"
import Spinner from "@/shared-module/common/components/Spinner"
import { baseTheme } from "@/shared-module/common/styles"
import type { TeacherChapterLockStatus } from "@/utils/chapterLockingStatus"
import { getTeacherChapterLockLabel } from "@/utils/chapterLockingStatus"

import { useStudentsContext, useStudentsListParams, useStudentsSorting } from "../StudentsContext"
import {
  DETAIL_SORT_COLUMNS,
  formatStudentName,
  useCourseStudentsIdentity,
  useCourseStudentsProgressDetail,
  useCourseStudentsProgressStructure,
} from "../studentsQueries"
import { StudentsTable } from "../StudentsTable"
import { staleTableCss } from "../studentsTableStyles"

type ChapterCellKey = `ch_${string}_${"points" | "attempts"}`

type ProgressRow = {
  user_id: string
  student: string
  total_points: number
  total_attempted: number
} & Partial<Record<ChapterCellKey, number | string | React.ReactNode | undefined>>

const round2 = (n: number) => Math.round(n * 100) / 100

export const ProgressTabContent: React.FC = () => {
  const { t } = useTranslation()
  const { courseId } = useStudentsContext()
  const params = useStudentsListParams()
  const { sorting, onSortingChange } = useStudentsSorting(DETAIL_SORT_COLUMNS)

  const identityQuery = useCourseStudentsIdentity(courseId, params)
  const identityRows = useMemo(() => identityQuery.data?.data ?? [], [identityQuery.data])
  const userIds = useMemo(() => identityRows.map((r) => r.user_id), [identityRows])
  // Course-level structure is cached per course; only the per-user detail is keyed by the page.
  const structureQuery = useCourseStudentsProgressStructure(courseId)
  const detailQuery = useCourseStudentsProgressDetail(courseId, userIds)

  // Deferred *after* userIds/detailQuery are derived so a search/sort/page commit still fires the
  // detail request promptly -- only the expensive per-user/per-chapter aggregation below is
  // deprioritized.
  const deferredIdentityRows = useDeferredValue(identityRows)
  const deferredStructureData = useDeferredValue(structureQuery.data)
  const deferredDetailData = useDeferredValue(detailQuery.data)
  const isStale =
    deferredIdentityRows !== identityRows ||
    deferredStructureData !== structureQuery.data ||
    deferredDetailData !== detailQuery.data

  const { allRows, dynamicColumns } = useMemo(() => {
    const structure = deferredStructureData
    const detail = deferredDetailData
    if (!structure || !detail) {
      return {
        allRows: [] as ProgressRow[],
        dynamicColumns: [] as ColumnDef<ProgressRow, unknown>[],
      }
    }

    const { chapters, chapter_availability, chapter_locking_enabled } = structure
    const { user_chapter_progress, user_chapter_locking_statuses } = detail
    const chapterLockStatuses = user_chapter_locking_statuses ?? []

    // --- maxima lookups (per chapter, not per user)
    const maxPointsByChapter: Record<string, number | undefined> = {}
    const maxAttemptsByChapter: Record<string, number | undefined> = {}
    for (const ca of chapter_availability ?? []) {
      if (!ca?.chapter_id) {
        continue
      }
      if (typeof ca.points_available === "number") {
        maxPointsByChapter[ca.chapter_id] = ca.points_available
      }
      if (typeof ca.exercises_available === "number") {
        maxAttemptsByChapter[ca.chapter_id] = ca.exercises_available
      }
    }

    const sortedChapters = [...chapters].toSorted(
      (a, b) => (a.chapter_number ?? 0) - (b.chapter_number ?? 0),
    )

    // --- columns: Student | Total | per-chapter with maxima in subheaders
    const cols: ColumnDef<ProgressRow, unknown>[] = [
      {
        // oxlint-disable-next-line i18next/no-literal-string
        id: "last_name",
        header: t("label-student"),
        // oxlint-disable-next-line i18next/no-literal-string
        accessorKey: "student",
      },
      {
        header: t("total"),
        columns: [
          // oxlint-disable-next-line i18next/no-literal-string
          { header: t("points"), accessorKey: "total_points", enableSorting: false },
          {
            header: t("attempts"),
            // oxlint-disable-next-line i18next/no-literal-string
            accessorKey: "total_attempted",
            enableSorting: false,
          },
        ],
      },
      ...sortedChapters.map((ch) => {
        const ptsMax = maxPointsByChapter[ch.id]
        const attMax = maxAttemptsByChapter[ch.id]
        return {
          header: `${ch.name ?? "-"}`,
          columns: [
            {
              header: `${t("points")} /${ptsMax ?? "0"}`,
              // oxlint-disable-next-line i18next/no-literal-string
              accessorKey: `ch_${ch.id}_points`,
              enableSorting: false,
            },
            {
              header: `${t("attempts")} /${attMax ?? "0"}`,
              // oxlint-disable-next-line i18next/no-literal-string
              accessorKey: `ch_${ch.id}_attempts`,
              enableSorting: false,
            },
          ],
        }
      }),
    ]

    // --- aggregate per-user, per-chapter
    const byUserChapter: Record<string, Record<string, { points: number; attempts: number }>> = {}
    for (const p of user_chapter_progress) {
      const uid = p.user_id
      const chId = p.chapter_id
      if (!byUserChapter[uid]) {
        byUserChapter[uid] = {}
      }
      byUserChapter[uid][chId] = {
        points: round2(typeof p.points_obtained === "number" ? p.points_obtained : 0),
        attempts: typeof p.exercises_attempted === "number" ? p.exercises_attempted : 0,
      }
    }
    const lockStatusByUserChapter: Record<string, Record<string, TeacherChapterLockStatus>> = {}
    for (const lockStatus of chapterLockStatuses) {
      const uid = lockStatus.user_id
      if (!lockStatusByUserChapter[uid]) {
        lockStatusByUserChapter[uid] = {}
      }
      lockStatusByUserChapter[uid][lockStatus.chapter_id] = lockStatus.status
    }

    // --- totals from same source
    const totalsByUser: Record<string, { total_points: number; total_attempted: number }> = {}
    for (const [uid, chapterMap] of Object.entries(byUserChapter)) {
      let tp = 0
      let ta = 0
      for (const v of Object.values(chapterMap)) {
        tp += v.points
        ta += v.attempts
      }
      totalsByUser[uid] = { total_points: round2(tp), total_attempted: ta }
    }

    // --- rows (identity provides the student list + order)
    const rows: ProgressRow[] = deferredIdentityRows.map((u) => {
      const totals = totalsByUser[u.user_id] ?? { total_points: 0, total_attempted: 0 }
      const row: ProgressRow = {
        user_id: u.user_id,
        student: formatStudentName(u, t),
        total_points: totals.total_points,
        total_attempted: totals.total_attempted,
      }

      for (const ch of sortedChapters) {
        // oxlint-disable-next-line i18next/no-literal-string
        const pointsKey: ChapterCellKey = `ch_${ch.id}_points`
        // oxlint-disable-next-line i18next/no-literal-string
        const attemptsKey: ChapterCellKey = `ch_${ch.id}_attempts`
        const cell = byUserChapter[u.user_id]?.[ch.id]
        row[pointsKey] = cell ? cell.points : 0
        const attempts = cell ? cell.attempts : 0
        if (chapter_locking_enabled !== true) {
          row[attemptsKey] = attempts
          continue
        }
        const lockStatus = lockStatusByUserChapter[u.user_id]?.[ch.id]
        const lockColor =
          lockStatus === "unlocked"
            ? baseTheme.colors.green[700]
            : lockStatus === "completed_and_locked"
              ? baseTheme.colors.blue[700]
              : lockStatus === "not_unlocked_yet"
                ? baseTheme.colors.crimson[700]
                : baseTheme.colors.gray[600]
        row[attemptsKey] = (
          <span>
            {attempts} (
            <span
              className={css`
                color: ${lockColor};
              `}
            >
              {getTeacherChapterLockLabel(t, lockStatus)}
            </span>
            )
          </span>
        )
      }
      return row
    })

    return { allRows: rows, dynamicColumns: cols }
  }, [deferredStructureData, deferredDetailData, deferredIdentityRows, t])

  if (identityQuery.isError) {
    return <ErrorBanner error={identityQuery.error} />
  }
  if (structureQuery.isError) {
    return <ErrorBanner error={structureQuery.error} />
  }
  if (detailQuery.isError) {
    return <ErrorBanner error={detailQuery.error} />
  }
  if (
    identityQuery.isPending ||
    structureQuery.isPending ||
    (userIds.length > 0 && detailQuery.isLoading)
  ) {
    return <Spinner variant="medium" />
  }

  return (
    <div className={isStale ? staleTableCss : undefined}>
      <StudentsTable
        columns={dynamicColumns}
        data={allRows}
        colorHeaders
        colorColumns
        colorHeaderUnderline
        progressMode
        sorting={sorting}
        onSortingChange={onSortingChange}
      />
    </div>
  )
}
