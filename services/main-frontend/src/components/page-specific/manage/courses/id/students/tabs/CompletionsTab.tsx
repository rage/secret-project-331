import { css } from "@emotion/css"
import { useQuery } from "@tanstack/react-query"
import type { CellContext, ColumnDef } from "@tanstack/react-table"
import { TFunction } from "i18next"
import React, { useMemo } from "react"
import { useTranslation } from "react-i18next"

import { FloatingHeaderTable } from "../FloatingHeaderTable"
import { COMPLETIONS_LEAF_MIN_WIDTH, PAD } from "../studentsTableStyles"

import { getCompletions } from "@/services/backend/courses/students"
import type { CompletionGridRow } from "@/shared-module/common/bindings"
import ErrorBanner from "@/shared-module/common/components/ErrorBanner"
import Spinner from "@/shared-module/common/components/Spinner"

type Props = { courseId: string; searchQuery: string }
type RowObject = Record<string, unknown> & { student: string }

const moduleKey = (name: string | null, t: TFunction) =>
  (name && name.trim().length > 0 ? name : t("default-module"))
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_]/g, "_")

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

const buildColumns = (modulesInOrder: string[], t: TFunction): ColumnDef<RowObject, unknown>[] => {
  const columns: ColumnDef<RowObject, unknown>[] = [
    {
      // eslint-disable-next-line i18next/no-literal-string
      id: "student",
      // eslint-disable-next-line i18next/no-literal-string
      header: "Student",
      // eslint-disable-next-line i18next/no-literal-string
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
    queryKey: ["completions-tab", courseId],
    queryFn: () => getCompletions(courseId),
    enabled: !!courseId,
  })

  const { modulesInOrder, data: allData } = useMemo(
    () => pivotCompletions((query.data as CompletionGridRow[] | undefined) ?? [], t),
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
