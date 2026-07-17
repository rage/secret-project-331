"use client"

import type { ColumnDef } from "@tanstack/react-table"
import React, { useDeferredValue, useMemo } from "react"
import { useTranslation } from "react-i18next"

import type { CourseStudentListRow } from "@/generated/api/types.generated"
import { QueryResult } from "@/shared-module/components"

import { useStudentsContext, useStudentsListParams, useStudentsSorting } from "../StudentsContext"
import { useCourseStudentsIdentity } from "../studentsQueries"
import { StudentsTable } from "../StudentsTable"
import { StaleTableWrapper } from "./StaleTableWrapper"

const EM_DASH = "—"

export const UserTabContent: React.FC = () => {
  const { t } = useTranslation()
  const { courseId } = useStudentsContext()
  const params = useStudentsListParams()
  const { sorting, onSortingChange } = useStudentsSorting()

  const query = useCourseStudentsIdentity(courseId, params)
  const deferredData = useDeferredValue(query.data)
  const isStale = deferredData !== query.data
  const rows = useMemo(() => deferredData?.data ?? [], [deferredData])

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
        accessorKey: "course_instances",
        enableSorting: false,
        cell: ({ row }) => {
          const instances = row.original.course_instances ?? []
          if (instances.length > 0) {
            // oxlint-disable-next-line i18next/no-literal-string
            return instances.join(", ")
          }
          // Empty list: distinguish the unnamed default instance from a since-deleted one.
          return row.original.has_active_instance ? t("default-instance") : t("deleted-instance")
        },
      },
    ],
    [t],
  )

  return (
    <QueryResult query={query} treatEmptyAsData>
      {() => (
        <StaleTableWrapper isStale={isStale}>
          <StudentsTable
            columns={columns}
            data={rows}
            sorting={sorting}
            onSortingChange={onSortingChange}
          />
        </StaleTableWrapper>
      )}
    </QueryResult>
  )
}
