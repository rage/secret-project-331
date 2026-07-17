"use client"

import { css } from "@emotion/css"
import type { ColumnDef } from "@tanstack/react-table"
import type { TFunction } from "i18next"
import React, { useDeferredValue, useMemo } from "react"
import { useTranslation } from "react-i18next"

import CourseModuleCompletionNeedsReviewBadge from "@/components/CourseModuleCompletionNeedsReviewBadge"
import type { CompletionGridRow } from "@/generated/api/types.generated"
import ErrorBanner from "@/shared-module/common/components/ErrorBanner"
import Spinner from "@/shared-module/common/components/Spinner"

import { useStudentsContext, useStudentsListParams, useStudentsSorting } from "../StudentsContext"
import {
  DETAIL_SORT_COLUMNS,
  formatStudentName,
  useCourseStudentsCompletionsDetail,
  useCourseStudentsIdentity,
} from "../studentsQueries"
import { StudentsTable } from "../StudentsTable"
import { COMPLETIONS_LEAF_MIN_WIDTH } from "../studentsTableStyles"
import { StaleTableWrapper } from "./StaleTableWrapper"

const PLACEHOLDER = "-"

type CompletionRow = Record<string, unknown> & { user_id: string; student: string }

/** One completion column group: keyed by the module's id (names are not unique), labelled by name. */
interface ModuleColumn {
  id: string
  label: string
}

const gradeKeyOf = (moduleId: string) => `${moduleId}__grade`
const passedKeyOf = (moduleId: string) => `${moduleId}__passed`
const registeredKeyOf = (moduleId: string) => `${moduleId}__registered`
const needsReviewKeyOf = (moduleId: string) => `${moduleId}__needsReview`

/**
 * Pivots the flat (user × module) completion rows into one wide row per user. Columns are keyed by
 * `module_id` (names are not unique) so modules with identical names never collide onto the same cells.
 */
const pivotCompletions = (
  identityRows: { user_id: string; first_name?: string | null; last_name?: string | null }[],
  completions: CompletionGridRow[],
  t: TFunction,
) => {
  const modulesInOrder: ModuleColumn[] = []
  const seen = new Set<string>()
  const byUser = new Map<string, Record<string, unknown>>()
  for (const r of completions) {
    if (!seen.has(r.module_id)) {
      seen.add(r.module_id)
      modulesInOrder.push({
        id: r.module_id,
        label: r.module && r.module.trim().length > 0 ? r.module : t("default-module"),
      })
    }
    const existing = byUser.get(r.user_id) ?? {}
    existing[gradeKeyOf(r.module_id)] = r.grade ?? null
    existing[passedKeyOf(r.module_id)] = r.passed ?? null
    existing[registeredKeyOf(r.module_id)] = r.registered
    existing[needsReviewKeyOf(r.module_id)] = r.needs_to_be_reviewed
    byUser.set(r.user_id, existing)
  }
  const data: CompletionRow[] = identityRows.map((u) => ({
    user_id: u.user_id,
    student: formatStudentName(u, t),
    ...byUser.get(u.user_id),
  }))
  return { modulesInOrder, data }
}

const gradeLabel = (grade: unknown, passed: unknown, t: TFunction): string => {
  if (typeof grade === "number") {
    return String(grade)
  }
  if (passed === true) {
    return t("passed")
  }
  if (passed === false) {
    return t("failed")
  }
  return PLACEHOLDER
}

const studentEllipsis = css`
  display: block;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`

const statusCellClass = css`
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.25rem;
`

const StatusCell: React.FC<{ registered: boolean; needsReview: boolean }> = ({
  registered,
  needsReview,
}) => {
  const { t } = useTranslation()
  const status = registered ? t("registered") : PLACEHOLDER
  const showStatus = registered || !needsReview
  return (
    <div className={statusCellClass}>
      {showStatus && <span>{status}</span>}
      {needsReview && <CourseModuleCompletionNeedsReviewBadge />}
    </div>
  )
}

const buildColumns = (
  modulesInOrder: ModuleColumn[],
  t: TFunction,
): ColumnDef<CompletionRow, unknown>[] => {
  const columns: ColumnDef<CompletionRow, unknown>[] = [
    {
      // oxlint-disable-next-line i18next/no-literal-string
      id: "last_name",
      header: t("label-student"),
      // oxlint-disable-next-line i18next/no-literal-string
      accessorKey: "student",
      meta: { minWidth: 80 },
      cell: ({ getValue }) => <span className={studentEllipsis}>{String(getValue() ?? "")}</span>,
    },
  ]

  modulesInOrder.forEach(({ id: moduleId, label }) => {
    columns.push({
      // oxlint-disable-next-line i18next/no-literal-string
      id: `${moduleId}__group`,
      header: label || "",
      columns: [
        {
          id: gradeKeyOf(moduleId),
          header: t("grade"),
          accessorKey: gradeKeyOf(moduleId),
          enableSorting: false,
          meta: { minWidth: COMPLETIONS_LEAF_MIN_WIDTH },
          cell: ({ row }) =>
            gradeLabel(row.original[gradeKeyOf(moduleId)], row.original[passedKeyOf(moduleId)], t),
        },
        {
          // oxlint-disable-next-line i18next/no-literal-string
          id: `${moduleId}__status`,
          header: t("status"),
          enableSorting: false,
          meta: { minWidth: COMPLETIONS_LEAF_MIN_WIDTH },
          cell: ({ row }) => (
            <StatusCell
              registered={Boolean(row.original[registeredKeyOf(moduleId)])}
              needsReview={Boolean(row.original[needsReviewKeyOf(moduleId)])}
            />
          ),
        },
      ],
    })
  })

  return columns
}

export const CompletionsTabContent: React.FC = () => {
  const { t } = useTranslation()
  const { courseId } = useStudentsContext()
  const params = useStudentsListParams()
  const { sorting, onSortingChange } = useStudentsSorting(DETAIL_SORT_COLUMNS)

  const identityQuery = useCourseStudentsIdentity(courseId, params)
  const identityRows = useMemo(() => identityQuery.data?.data ?? [], [identityQuery.data])
  const userIds = useMemo(() => identityRows.map((r) => r.user_id), [identityRows])
  const detailQuery = useCourseStudentsCompletionsDetail(courseId, userIds)

  // Deferred *after* userIds/detailQuery are derived so a search/sort/page commit still fires the
  // detail request promptly -- only the expensive pivot below is deprioritized.
  const deferredIdentityRows = useDeferredValue(identityRows)
  const deferredDetailData = useDeferredValue(detailQuery.data)
  const isStale = deferredIdentityRows !== identityRows || deferredDetailData !== detailQuery.data

  const { modulesInOrder, data } = useMemo(
    () => pivotCompletions(deferredIdentityRows, deferredDetailData ?? [], t),
    [deferredIdentityRows, deferredDetailData, t],
  )
  const columns = useMemo(() => buildColumns(modulesInOrder, t), [modulesInOrder, t])

  if (identityQuery.isError) {
    return <ErrorBanner error={identityQuery.error} />
  }
  if (detailQuery.isError) {
    return <ErrorBanner error={detailQuery.error} />
  }
  if (identityQuery.isPending || (userIds.length > 0 && detailQuery.isLoading)) {
    return <Spinner variant="medium" />
  }

  return (
    <StaleTableWrapper isStale={isStale}>
      <StudentsTable
        columns={columns}
        data={data}
        colorHeaders
        colorColumns
        colorHeaderUnderline
        sorting={sorting}
        onSortingChange={onSortingChange}
      />
    </StaleTableWrapper>
  )
}
