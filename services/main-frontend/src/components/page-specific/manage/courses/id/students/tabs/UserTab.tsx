import { useQuery } from "@tanstack/react-query"
import React from "react"
import { useTranslation } from "react-i18next"

import { FloatingHeaderTable } from "../FloatingHeaderTable"

import { getCourseUsers } from "@/services/backend/courses/students"
import { CourseUserInfo } from "@/shared-module/common/bindings"
import ErrorBanner from "@/shared-module/common/components/ErrorBanner"
import Spinner from "@/shared-module/common/components/Spinner"

export const UserTabContent: React.FC<{ courseId: string }> = ({ courseId }) => {
  const { t } = useTranslation()

  const query = useQuery({
    queryKey: ["user-tab", courseId],
    queryFn: () => getCourseUsers(courseId),
  })

  if (query.isLoading) {
    return <Spinner />
  }
  if (query.isError) {
    return <ErrorBanner error={query.error} />
  }

  const rows = (query.data ?? []) as CourseUserInfo[]

  return (
    <FloatingHeaderTable
      columns={[
        {
          header: t("label-name"),
          // eslint-disable-next-line i18next/no-literal-string
          accessorKey: "name",
        },
        {
          header: t("user-id"),
          // eslint-disable-next-line i18next/no-literal-string
          accessorKey: "user_id",
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
        },
      ]}
      data={rows}
    />
  )
}
