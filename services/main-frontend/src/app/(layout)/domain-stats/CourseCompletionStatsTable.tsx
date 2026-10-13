"use client"

import type { UseQueryResult } from "@tanstack/react-query"
import { useId } from "react"
import { useTranslation } from "react-i18next"

import { DENSITY_COMPACT } from "@/components/credit-registration/constants"
import type { CourseCompletionStats } from "@/generated/api/types.generated"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"
import { QueryResult, Table } from "@/shared-module/components"

interface CourseCompletionStatsTableProps {
  query: UseQueryResult<CourseCompletionStats[]>
  domain: string
}

const CourseCompletionStatsTable: React.FC<CourseCompletionStatsTableProps> = ({
  query,
  domain,
}) => {
  const { t } = useTranslation()
  const headingId = useId()

  const renderTable = (data: CourseCompletionStats[]) => (
    <div>
      <h3 id={headingId}>
        {t("courses-completed-by-users-from")} {domain}
      </h3>
      <Table
        labelledBy={headingId}
        density={DENSITY_COMPACT}
        rows={data}
        rowKey={(course) => course.course_id}
        columns={[
          { header: t("course"), cell: (course) => course.course_name },
          { header: t("total-completions"), cell: (course) => course.total_completions },
          { header: t("unique-users"), cell: (course) => course.unique_users },
          {
            header: t("registered-percentage"),
            cell: (course) => `${course.registered_completion_percentage?.toFixed(2) || "-"}%`,
          },
          { header: t("registered-completions"), cell: (course) => course.registered_completions },
          {
            header: t("unregistered-completions"),
            cell: (course) => course.not_registered_completions,
          },
          {
            header: t("users-with-registered"),
            cell: (course) => course.users_with_some_registered_completions,
          },
          {
            header: t("users-with-unregistered"),
            cell: (course) => course.users_with_some_unregistered_completions,
          },
          {
            header: t("registered-ects"),
            cell: (course) => course.registered_ects_credits.toFixed(1),
          },
          {
            header: t("unregistered-ects"),
            cell: (course) => course.not_registered_ects_credits.toFixed(1),
          },
        ]}
      />
    </div>
  )

  return (
    <QueryResult query={query} treatEmptyAsData>
      {(data) => renderTable(data)}
    </QueryResult>
  )
}

export default withErrorBoundary(CourseCompletionStatsTable)
