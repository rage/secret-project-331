"use client"

import { css } from "@emotion/css"
import { useQuery } from "@tanstack/react-query"
import type { CellContext, ColumnDef } from "@tanstack/react-table"
import type { TFunction } from "i18next"
import React, { useMemo } from "react"
import { useTranslation } from "react-i18next"

import CourseModuleCompletionNeedsReviewBadge from "@/components/CourseModuleCompletionNeedsReviewBadge"
import { getCourseStudentsCompletionsOptions } from "@/generated/api/@tanstack/react-query.generated"
import type { CompletionGridRow } from "@/generated/api/types.generated"
import ErrorBanner from "@/shared-module/common/components/ErrorBanner"
import { QueryResult } from "@/shared-module/components"

import { FloatingHeaderTable } from "../FloatingHeaderTable"
import { COMPLETIONS_LEAF_MIN_WIDTH, PAD } from "../studentsTableStyles"

interface Props {
  courseId: string
  searchQuery: string
}
type RowObject = Record<string, unknown> & { student: string }

const moduleKey = (name: string | null, t: TFunction) =>
  (name && name.trim().length > 0 ? name : t("default-module"))
    .toLowerCase()
    .replaceAll(/\s+/g, "_")
    .replaceAll(/[^a-z0-9_]/g, "_")

const pivotCompletions = (rows: CompletionGridRow[], t: TFunction) => {
  const modulesInOrder: string[] = []
  const seen = new Set<string>()
  for (const r of rows) {
    const label = r.module ?? t("default-module")
    if (!seen.has(label)) {
      seen.add(label)
      modulesInOrder.push(label)
    }
  }
  const byStudent = new Map<string, RowObject>()
  for (const r of rows) {
    const key = r.student
    const modLabel = r.module ?? t("default-module")
    const mKey = moduleKey(modLabel, t)
    const existing: RowObject = byStudent.get(key) ?? { student: key }
    // oxlint-disable-next-line i18next/no-literal-string
    existing[`${mKey}__grade`] = r.grade ?? "-"
    // oxlint-disable-next-line i18next/no-literal-string
    existing[`${mKey}__status`] = r.status ?? "-"
    // oxlint-disable-next-line i18next/no-literal-string
    existing[`${mKey}__needsReview`] = r.needs_to_be_reviewed
    byStudent.set(key, existing)
  }
  return { modulesInOrder, data: Array.from(byStudent.values()) }
}

const studentEllipsis = css`
  display: block;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`

const StudentCell = ({ getValue }: CellContext<RowObject, unknown>) => (
  <span className={studentEllipsis}>{String(getValue() ?? "")}</span>
)

const statusCellClass = css`
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.25rem;
`

interface StatusCellProps extends CellContext<RowObject, unknown> {
  needsReviewKey: string
}

const CompletionStatusCell: React.FC<StatusCellProps> = ({ getValue, row, needsReviewKey }) => {
  const status = String(getValue() ?? "-")
  const needsReview = Boolean(row.original[needsReviewKey])
  const showStatus = status !== "-" || !needsReview

  return (
    <div className={statusCellClass}>
      {showStatus && <span>{status}</span>}
      {needsReview && <CourseModuleCompletionNeedsReviewBadge />}
    </div>
  )
}

const buildColumns = (modulesInOrder: string[], t: TFunction): ColumnDef<RowObject, unknown>[] => {
  const columns: ColumnDef<RowObject, unknown>[] = [
    {
      // oxlint-disable-next-line i18next/no-literal-string
      id: "student",
      // oxlint-disable-next-line i18next/no-literal-string
      header: "Student",
      // oxlint-disable-next-line i18next/no-literal-string
      accessorKey: "student",
      meta: {
        sticky: true,
        minWidth: 80,
        padLeft: PAD,
        padRight: PAD,
      },
      cell: StudentCell,
    },
  ]

  modulesInOrder.forEach((label, groupIdx) => {
    const mKey = moduleKey(label, t)
    // oxlint-disable-next-line i18next/no-literal-string
    const needsReviewKey = `${mKey}__needsReview`
    const colorPairIndex = groupIdx
    columns.push({
      // oxlint-disable-next-line i18next/no-literal-string
      id: `${mKey}__group`,
      header: label || "",
      meta: { colorPairIndex },
      columns: [
        {
          // oxlint-disable-next-line i18next/no-literal-string
          id: `${mKey}__grade`,
          // oxlint-disable-next-line i18next/no-literal-string
          header: "Grade",
          // oxlint-disable-next-line i18next/no-literal-string
          accessorKey: `${mKey}__grade`,
          meta: {
            minWidth: COMPLETIONS_LEAF_MIN_WIDTH,
            colorPairIndex,
            subIdx: 0,
            padLeft: PAD,
            padRight: PAD,
          },
        },
        {
          // oxlint-disable-next-line i18next/no-literal-string
          id: `${mKey}__status`,
          // oxlint-disable-next-line i18next/no-literal-string
          header: "Status",
          // oxlint-disable-next-line i18next/no-literal-string
          accessorKey: `${mKey}__status`,
          cell: (props) => <CompletionStatusCell {...props} needsReviewKey={needsReviewKey} />,
          meta: {
            minWidth: COMPLETIONS_LEAF_MIN_WIDTH,
            colorPairIndex,
            subIdx: 1,
            padLeft: PAD,
            padRight: PAD,
          },
        },
      ],
    })
  })

  return columns
}

export const CompletionsTabContent: React.FC<Props> = ({ courseId, searchQuery }) => {
  const { t } = useTranslation()
  const query = useQuery({
    ...getCourseStudentsCompletionsOptions({
      path: {
        course_id: courseId,
      },
    }),
  })

  const { modulesInOrder, data: allData } = useMemo(
    () => pivotCompletions(query.data ?? [], t),
    [query.data, t],
  )

  const data = useMemo(() => {
    if (!searchQuery.trim()) {
      return allData
    }
    const queryLower = searchQuery.toLowerCase()
    return allData.filter((row) => {
      const student = String(row.student ?? "").toLowerCase()
      return student.includes(queryLower)
    })
  }, [allData, searchQuery])

  const columns = useMemo<ColumnDef<RowObject, unknown>[]>(
    () => buildColumns(modulesInOrder, t),
    [modulesInOrder, t],
  )

  if (!courseId) {
    return <ErrorBanner error={new Error("Missing courseId")} />
  }

  const table = (
    <FloatingHeaderTable
      columns={columns}
      data={data}
      colorHeaders
      colorColumns
      colorHeaderUnderline
    />
  )

  return (
    <QueryResult query={query} treatEmptyAsData>
      {() => table}
    </QueryResult>
  )
}
