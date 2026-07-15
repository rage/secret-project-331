"use client"

import { css } from "@emotion/css"
import type { ColumnDef } from "@tanstack/react-table"
import type { TFunction } from "i18next"
import React, { useMemo } from "react"
import { useTranslation } from "react-i18next"

import { useStudentsContext, useStudentsListParams, useStudentsSorting } from "../StudentsContext"
import { StudentsTable } from "../StudentsTable"
import { COMPLETIONS_LEAF_MIN_WIDTH, PAD } from "../studentsTableStyles"
import {
  DETAIL_SORT_COLUMNS,
  formatStudentName,
  useCourseStudentsCompletionsDetail,
  useCourseStudentsIdentity,
} from "../studentsQueries"

import CourseModuleCompletionNeedsReviewBadge from "@/components/CourseModuleCompletionNeedsReviewBadge"
import type { CompletionGridRow } from "@/generated/api/types.generated"
import ErrorBanner from "@/shared-module/common/components/ErrorBanner"
import Spinner from "@/shared-module/common/components/Spinner"

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
 * Pivots the flat (user × module) completion rows into one wide row per identity user. Columns are
 * keyed by `module_id` (the server orders rows by module order_number) so two modules with the same
 * or punctuation-only-differing names never collide onto the same cells.
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
      meta: { sticky: true, minWidth: 80, padLeft: PAD, padRight: PAD },
      cell: ({ getValue }) => <span className={studentEllipsis}>{String(getValue() ?? "")}</span>,
    },
  ]

  modulesInOrder.forEach(({ id: moduleId, label }, groupIdx) => {
    const colorPairIndex = groupIdx
    columns.push({
      // oxlint-disable-next-line i18next/no-literal-string
      id: `${moduleId}__group`,
      header: label || "",
      meta: { colorPairIndex },
      columns: [
        {
          id: gradeKeyOf(moduleId),
          header: t("grade"),
          accessorKey: gradeKeyOf(moduleId),
          enableSorting: false,
          meta: {
            minWidth: COMPLETIONS_LEAF_MIN_WIDTH,
            colorPairIndex,
            subIdx: 0,
            padLeft: PAD,
            padRight: PAD,
          },
          cell: ({ row }) =>
            gradeLabel(row.original[gradeKeyOf(moduleId)], row.original[passedKeyOf(moduleId)], t),
        },
        {
          // oxlint-disable-next-line i18next/no-literal-string
          id: `${moduleId}__status`,
          header: t("status"),
          enableSorting: false,
          meta: {
            minWidth: COMPLETIONS_LEAF_MIN_WIDTH,
            colorPairIndex,
            subIdx: 1,
            padLeft: PAD,
            padRight: PAD,
          },
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

  const { modulesInOrder, data } = useMemo(
    () => pivotCompletions(identityRows, detailQuery.data ?? [], t),
    [identityRows, detailQuery.data, t],
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
    <StudentsTable
      columns={columns}
      data={data}
      colorHeaders
      colorColumns
      colorHeaderUnderline
      sorting={sorting}
      onSortingChange={onSortingChange}
    />
  )
}
