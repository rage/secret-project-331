"use client"

import type { ColumnDef } from "@tanstack/react-table"
import React, { useMemo } from "react"
import { useTranslation } from "react-i18next"

import { useStudentsContext, useStudentsListParams, useStudentsSorting } from "../StudentsContext"
import { StudentsTable } from "../StudentsTable"
import { useCourseStudentsIdentity } from "../studentsQueries"

import type { CourseStudentListRow } from "@/generated/api/types.generated"
import { QueryResult } from "@/shared-module/components"

const EM_DASH = "—"

export const UserTabContent: React.FC = () => {
  const { t } = useTranslation()
  const { courseId } = useStudentsContext()
  const params = useStudentsListParams()
  const { sorting, onSortingChange } = useStudentsSorting()

  const query = useCourseStudentsIdentity(courseId, params)
  const rows = useMemo(() => query.data?.data ?? [], [query.data])

  const columns = useMemo<ColumnDef<CourseStudentListRow, unknown>[]>(
    () => [
      {
        header: t("user-id"),
        // oxlint-disable-next-line i18next/no-literal-string
        accessorKey: "user_id",
        enableSorting: false,
      },
      {
        header: t("first-name"),
        // oxlint-disable-next-line i18next/no-literal-string
        accessorKey: "first_name",
        cell: ({ getValue }) => getValue<string | null>() ?? EM_DASH,
      },
      {
        header: t("last-name"),
        // oxlint-disable-next-line i18next/no-literal-string
        accessorKey: "last_name",
        cell: ({ getValue }) => getValue<string | null>() ?? EM_DASH,
      },
      {
        header: t("label-email"),
        // oxlint-disable-next-line i18next/no-literal-string
        accessorKey: "email",
        cell: ({ getValue }) => getValue<string | null>() ?? EM_DASH,
      },
      {
        header: t("course-instance"),
        // oxlint-disable-next-line i18next/no-literal-string
        id: "course_instances",
        // oxlint-disable-next-line i18next/no-literal-string
        accessorKey: "course_instances",
        enableSorting: false,
        cell: ({ getValue }) => {
          const instances = getValue<string[]>() ?? []
          // oxlint-disable-next-line i18next/no-literal-string
          return instances.length > 0 ? instances.join(", ") : t("default-instance")
        },
      },
    ],
    [t],
  )

  return (
    <QueryResult query={query} treatEmptyAsData>
      {() => (
        <StudentsTable
          columns={columns}
          data={rows}
          sorting={sorting}
          onSortingChange={onSortingChange}
        />
      )}
    </QueryResult>
  )
}
