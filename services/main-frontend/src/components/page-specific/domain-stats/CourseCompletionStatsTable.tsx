import { UseQueryResult } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"

import FullWidthTable, { FullWidthTableRow } from "../../tables/FullWidthTable"

import { CourseCompletionStats } from "@/shared-module/common/bindings"
import ErrorBanner from "@/shared-module/common/components/ErrorBanner"
import Spinner from "@/shared-module/common/components/Spinner"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"

interface CourseCompletionStatsTableProps {
  query: UseQueryResult<CourseCompletionStats[]>
  domain: string
}

const CourseCompletionStatsTable: React.FC<CourseCompletionStatsTableProps> = ({
  query,
  domain,
}) => {
  const { t } = useTranslation()

  if (query.isError) {
    return <ErrorBanner variant="text" error={query.error} />
  }

  if (query.isLoading) {
    return (
      <div>
        <Spinner variant="medium" />
      </div>
    )
  }

  return (
    <div>
      <h3>
        {t("courses-completed-by-users-from")} {domain}
      </h3>
      <FullWidthTable>
        <thead>
          <FullWidthTableRow>
            <th>{t("course")}</th>
            <th>{t("total-completions")}</th>
            <th>{t("unique-users")}</th>
            <th>{t("registered-percentage")}</th>
            <th>{t("registered-completions")}</th>
            <th>{t("unregistered-completions")}</th>
            <th>{t("users-with-registered")}</th>
            <th>{t("users-with-unregistered")}</th>
            <th>{t("registered-ects")}</th>
            <th>{t("unregistered-ects")}</th>
          </FullWidthTableRow>
        </thead>
        <tbody>
          {query.data?.map((course) => (
            <FullWidthTableRow key={course.course_id}>
              <td>{course.course_name}</td>
              <td>{course.total_completions}</td>
              <td>{course.unique_users}</td>
              <td>{course.registered_completion_percentage?.toFixed(2) || "-"}%</td>
              <td>{course.registered_completions}</td>
              <td>{course.not_registered_completions}</td>
              <td>{course.users_with_some_registered_completions}</td>
              <td>{course.users_with_some_unregistered_completions}</td>
              <td>{course.registered_ects_credits.toFixed(1)}</td>
              <td>{course.not_registered_ects_credits.toFixed(1)}</td>
            </FullWidthTableRow>
          ))}
        </tbody>
      </FullWidthTable>
    </div>
  )
}

export default withErrorBoundary(CourseCompletionStatsTable)
