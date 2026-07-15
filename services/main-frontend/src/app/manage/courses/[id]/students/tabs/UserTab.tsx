"use client"

import { useQuery } from "@tanstack/react-query"
import React, { useMemo } from "react"
import { useTranslation } from "react-i18next"

import { getCourseStudentsUsersOptions } from "@/generated/api/@tanstack/react-query.generated"
import { QueryResult } from "@/shared-module/components"

import { FloatingHeaderTable } from "../FloatingHeaderTable"

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

  const allRows = useMemo(() => query.data ?? [], [query.data])

  const rows = useMemo(() => {
    if (!searchQuery.trim()) {
      return allRows
    }
    const queryLower = searchQuery.toLowerCase()
    return allRows.filter((row) => {
      const userId = String(row.user_id ?? "").toLowerCase()
      const firstName = String(row.first_name ?? "").toLowerCase()
      const lastName = String(row.last_name ?? "").toLowerCase()
      const email = String(row.email ?? "").toLowerCase()
      const courseInstance = String(row.course_instance ?? "").toLowerCase()
      return (
        userId.includes(queryLower) ||
        firstName.includes(queryLower) ||
        lastName.includes(queryLower) ||
        email.includes(queryLower) ||
        courseInstance.includes(queryLower)
      )
    })
  }, [allRows, searchQuery])

  const table = (
    <FloatingHeaderTable
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
    />
  )

  return (
    <QueryResult query={query} treatEmptyAsData>
      {() => table}
    </QueryResult>
  )
}
