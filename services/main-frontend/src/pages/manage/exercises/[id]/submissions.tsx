import { useQuery } from "@tanstack/react-query"
import React from "react"
import { useTranslation } from "react-i18next"

import Layout from "../../../../components/Layout"
import ExerciseSubmissionList from "../../../../components/page-specific/manage/exercises/id/submissions/ExerciseSubmissionList"
import { fetchExerciseSubmissions } from "../../../../services/backend/exercises"
import ErrorBanner from "../../../../shared-module/components/ErrorBanner"
import Pagination from "../../../../shared-module/components/Pagination"
import Spinner from "../../../../shared-module/components/Spinner"
import { withSignedIn } from "../../../../shared-module/contexts/LoginStateContext"
import usePaginationInfo from "../../../../shared-module/hooks/usePaginationInfo"
import {
  dontRenderUntilQueryParametersReady,
  SimplifiedUrlQuery,
} from "../../../../shared-module/utils/dontRenderUntilQueryParametersReady"
import withErrorBoundary from "../../../../shared-module/utils/withErrorBoundary"

interface SubmissionPageProps {
  query: SimplifiedUrlQuery<"id">
}

const SubmissionsPage: React.FC<React.PropsWithChildren<SubmissionPageProps>> = ({ query }) => {
  const { t } = useTranslation()
  const paginationInfo = usePaginationInfo()

  const getExerciseSubmissions = useQuery(
    [`exercise-submissions`, query.id, paginationInfo.page, paginationInfo.limit],
    () => fetchExerciseSubmissions(query.id, paginationInfo.page, paginationInfo.limit),
  )

  return (
    <Layout navVariant="simple">
      <div>
        <h4>{t("header-submissions")}</h4>
        {getExerciseSubmissions.isError && (
          <ErrorBanner variant={"readOnly"} error={getExerciseSubmissions.error} />
        )}
        {getExerciseSubmissions.isLoading && <Spinner variant={"medium"} />}
        {getExerciseSubmissions.isSuccess && (
          <>
            <ExerciseSubmissionList exerciseSubmissions={getExerciseSubmissions.data.data} />
            <Pagination
              totalPages={getExerciseSubmissions.data.total_pages}
              paginationInfo={paginationInfo}
            />
          </>
        )}
      </div>
    </Layout>
  )
}

export default withErrorBoundary(withSignedIn(dontRenderUntilQueryParametersReady(SubmissionsPage)))
