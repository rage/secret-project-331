"use client"

import { useQuery } from "@tanstack/react-query"
import React, { useMemo } from "react"
import { useTranslation } from "react-i18next"

import { StudentsTable } from "../StudentsTable"

import { getCourseStudentsUsersOptions } from "@/generated/api/@tanstack/react-query.generated"
import { QueryResult } from "@/shared-module/components"

// oxlint-disable-next-line i18next/no-literal-string
const SEARCHABLE_COLUMNS = ["user_id", "first_name", "last_name", "email", "course_instance"]

export const UserTabContent: React.FC<{ courseId: string; searchQuery: string }> = ({
  courseId,
  searchQuery,
}) => {
  const { t } = useTranslation()

  const query = useQuery({
    ...getCourseStudentsUsersOptions({
      path: {
        course_id: courseId,
      },
    }),
  })

  const rows = useMemo(() => query.data ?? [], [query.data])

  const table = (
    <StudentsTable
      columns={[
        {
          header: t("user-id"),
          // oxlint-disable-next-line i18next/no-literal-string
          accessorKey: "user_id",
        },
        {
          header: t("first-name"),
          // oxlint-disable-next-line i18next/no-literal-string
          accessorKey: "first_name",
          // oxlint-disable-next-line i18next/no-literal-string
          cell: ({ getValue }) => getValue<string | null>() ?? "—",
        },
        {
          header: t("last-name"),
          // oxlint-disable-next-line i18next/no-literal-string
          accessorKey: "last_name",
          // oxlint-disable-next-line i18next/no-literal-string
          cell: ({ getValue }) => getValue<string | null>() ?? "—",
        },
        {
          header: t("label-email"),
          // oxlint-disable-next-line i18next/no-literal-string
          accessorKey: "email",
          // oxlint-disable-next-line i18next/no-literal-string
          cell: ({ getValue }) => getValue<string | null>() ?? "—",
        },
        {
          header: t("course-instance"),
          // oxlint-disable-next-line i18next/no-literal-string
          accessorKey: "course_instance",
          cell: ({ getValue }) => getValue<string | null>() ?? t("default-instance"),
        },
      ]}
      data={rows}
      globalFilter={searchQuery}
      searchableColumnIds={SEARCHABLE_COLUMNS}
    />
  )

  return (
    <QueryResult query={query} treatEmptyAsData>
      {() => table}
    </QueryResult>
  )
}
