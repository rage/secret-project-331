"use client"

import type { ColumnDef } from "@tanstack/react-table"
import React, { useDeferredValue, useMemo } from "react"
import { useTranslation } from "react-i18next"

import type { CourseStudentListRow } from "@/generated/api/types.generated"
import { QueryResult } from "@/shared-module/components"

import { useStudentsContext, useStudentsListParams, useStudentsSorting } from "../StudentsContext"
import { USERS_SORT_COLUMNS, useCourseStudentsIdentity } from "../studentsQueries"
import { StudentsTable } from "../StudentsTable"
import { StaleTableWrapper } from "./StaleTableWrapper"
import { StudentPillCell } from "./StudentPillCell"

const EM_DASH = "—"

export const UserTabContent: React.FC = () => {
  const { t } = useTranslation()
  const { courseId } = useStudentsContext()
  const params = useStudentsListParams()
  const { sorting, onSortingChange } = useStudentsSorting(USERS_SORT_COLUMNS)

  const query = useCourseStudentsIdentity(courseId, params)
  const deferredData = useDeferredValue(query.data)
  const isStale = deferredData !== query.data
  const rows = useMemo(() => deferredData?.data ?? [], [deferredData])

  const columns = useMemo<ColumnDef<CourseStudentListRow, unknown>[]>(
    () => [
      {
        // id drives the shared `last_name` sort key; the pill shows the name and opens the details popover.
        // oxlint-disable-next-line i18next/no-literal-string
        id: "last_name",
        header: t("label-student"),
        cell: ({ row }) => (
          <StudentPillCell
            userId={row.original.user_id}
            firstName={row.original.first_name}
            lastName={row.original.last_name}
            email={row.original.email}
          />
        ),
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
