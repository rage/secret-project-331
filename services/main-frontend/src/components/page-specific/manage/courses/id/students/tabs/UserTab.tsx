"use client"

import { useQuery } from "@tanstack/react-query"
import React, { useMemo } from "react"
import { useTranslation } from "react-i18next"

import { FloatingHeaderTable } from "../FloatingHeaderTable"

import { getCourseUsers } from "@/services/backend/courses/students"
import { CourseUserInfo } from "@/shared-module/common/bindings"
import ErrorBanner from "@/shared-module/common/components/ErrorBanner"
import Spinner from "@/shared-module/common/components/Spinner"

export const UserTabContent: React.FC<{ courseId: string; searchQuery: string }> = ({
  courseId,
  searchQuery,
}) => {
  const { t } = useTranslation()

  const query = useQuery({
    queryKey: ["user-tab", courseId],
    queryFn: () => getCourseUsers(courseId),
  })

  const allRows = useMemo(() => (query.data ?? []) as CourseUserInfo[], [query.data])

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

  if (query.isLoading) {
    return <Spinner />
  }
  if (query.isError) {
    return <ErrorBanner error={query.error} />
  }

  return (
    <FloatingHeaderTable
      columns={[
        {
          header: t("user-id"),
          // eslint-disable-next-line i18next/no-literal-string
          accessorKey: "user_id",
        },
        {
          header: t("first-name"),
          // eslint-disable-next-line i18next/no-literal-string
          accessorKey: "first_name",
          // eslint-disable-next-line i18next/no-literal-string
          cell: ({ getValue }) => getValue<string | null>() ?? "—",
        },
        {
          header: t("last-name"),
          // eslint-disable-next-line i18next/no-literal-string
          accessorKey: "last_name",
          // eslint-disable-next-line i18next/no-literal-string
          cell: ({ getValue }) => getValue<string | null>() ?? "—",
        },
        {
          header: t("label-email"),
          // eslint-disable-next-line i18next/no-literal-string
          accessorKey: "email",
          // eslint-disable-next-line i18next/no-literal-string
          cell: ({ getValue }) => getValue<string | null>() ?? "—",
        },
        {
          header: t("course-instance"),
          // eslint-disable-next-line i18next/no-literal-string
          accessorKey: "course_instance",
          cell: ({ getValue }) => getValue<string | null>() ?? t("default-instance"),
        },
      ]}
      data={rows}
    />
  )
}
