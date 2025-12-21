import { css } from "@emotion/css"
import { useQuery } from "@tanstack/react-query"
import type { CellContext, ColumnDef } from "@tanstack/react-table"
import React, { useMemo } from "react"

import { FloatingHeaderTable } from "../FloatingHeaderTable"
import { COMPLETIONS_LEAF_MIN_WIDTH, COMPLETIONS_LEAF_WIDTH, PAD } from "../studentsTableStyles"

import { getCompletions } from "@/services/backend/courses/students"
import type { CompletionGridRow } from "@/shared-module/common/bindings"
import ErrorBanner from "@/shared-module/common/components/ErrorBanner"
import Spinner from "@/shared-module/common/components/Spinner"

type Props = { courseId: string }
type RowObject = Record<string, unknown> & { student: string }

const moduleKey = (name: string | null) =>
  // eslint-disable-next-line i18next/no-literal-string
  (name && name.trim().length > 0 ? name : "Default")
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_]/g, "_")

const pivotCompletions = (rows: CompletionGridRow[]) => {
  const modulesInOrder: string[] = []
  const seen = new Set<string>()
  for (const r of rows) {
    const label = r.module ?? ""
    if (!seen.has(label)) {
      seen.add(label)
      modulesInOrder.push(label)
    }
  }
  const byStudent = new Map<string, RowObject>()
  for (const r of rows) {
    const key = r.student
    const modLabel = r.module ?? ""
    const mKey = moduleKey(modLabel)
    const existing = byStudent.get(key) ?? { student: key }
    // eslint-disable-next-line i18next/no-literal-string
    existing[`${mKey}__grade`] = r.grade ?? "-"
    // eslint-disable-next-line i18next/no-literal-string
    existing[`${mKey}__status`] = r.status ?? "-"
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

const buildColumns = (modulesInOrder: string[]): ColumnDef<RowObject, unknown>[] => {
  const columns: ColumnDef<RowObject, unknown>[] = [
    {
      // eslint-disable-next-line i18next/no-literal-string
      id: "student",
      // eslint-disable-next-line i18next/no-literal-string
      header: "Student",
      // eslint-disable-next-line i18next/no-literal-string
      accessorKey: "student",
      meta: { sticky: true, width: 260, minWidth: 120, padLeft: PAD, padRight: PAD },
      cell: StudentCell,
    },
  ]

  modulesInOrder.forEach((label, groupIdx) => {
    const mKey = moduleKey(label)
    const colorPairIndex = groupIdx
    columns.push({
      // eslint-disable-next-line i18next/no-literal-string
      id: `${mKey}__group`,
      header: label || "",
      meta: { colorPairIndex },
      columns: [
        {
          // eslint-disable-next-line i18next/no-literal-string
          id: `${mKey}__grade`,
          // eslint-disable-next-line i18next/no-literal-string
          header: "Grade",
          // eslint-disable-next-line i18next/no-literal-string
          accessorKey: `${mKey}__grade`,
          meta: {
            width: COMPLETIONS_LEAF_WIDTH,
            minWidth: COMPLETIONS_LEAF_MIN_WIDTH,
            colorPairIndex,
            subIdx: 0,
            padLeft: PAD,
            padRight: PAD,
          },
        },
        {
          // eslint-disable-next-line i18next/no-literal-string
          id: `${mKey}__status`,
          // eslint-disable-next-line i18next/no-literal-string
          header: "Status",
          // eslint-disable-next-line i18next/no-literal-string
          accessorKey: `${mKey}__status`,
          meta: {
            width: COMPLETIONS_LEAF_WIDTH,
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

export const CompletionsTabContent: React.FC<Props> = ({ courseId }) => {
  const query = useQuery({
    queryKey: ["completions-tab", courseId],
    queryFn: () => getCompletions(courseId),
    enabled: !!courseId,
  })

  const { modulesInOrder, data } = useMemo(
    () => pivotCompletions((query.data as CompletionGridRow[] | undefined) ?? []),
    [query.data],
  )

  const columns = useMemo<ColumnDef<RowObject, unknown>[]>(
    () => buildColumns(modulesInOrder),
    [modulesInOrder],
  )

  if (!courseId) {
    return <ErrorBanner error={new Error("Missing courseId")} />
  }
  if (query.isLoading) {
    return <Spinner />
  }
  if (query.isError) {
    return <ErrorBanner error={query.error} />
  }

  return (
    <FloatingHeaderTable
      columns={columns}
      data={data}
      colorHeaders
      colorColumns
      colorHeaderUnderline
    />
  )
}
