import { css } from "@emotion/css"
import { useQuery } from "@tanstack/react-query"
import React from "react"
import { useTranslation } from "react-i18next"

import ExerciseSubmissionList from "../../../../components/page-specific/manage/exercises/id/submissions/ExerciseSubmissionList"
import { fetchExerciseSubmissions } from "../../../../services/backend/exercises"
import ErrorBanner from "../../../../shared-module/components/ErrorBanner"
import Pagination from "../../../../shared-module/components/Pagination"
import Spinner from "../../../../shared-module/components/Spinner"
import { withSignedIn } from "../../../../shared-module/contexts/LoginStateContext"
import usePaginationInfo from "../../../../shared-module/hooks/usePaginationInfo"
import { fontWeights } from "../../../../shared-module/styles"
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

  const exerciseSubmissionsQuery = useQuery({
    queryKey: [`exercise-submissions`, query.id, paginationInfo.page, paginationInfo.limit],
    queryFn: () => fetchExerciseSubmissions(query.id, paginationInfo.page, paginationInfo.limit),
  })

  return (
    <div>
      <h3
        className={css`
          font-weight: ${fontWeights.medium};
        `}
      >
        {t("header-submissions")}
      </h3>
      {exerciseSubmissionsQuery.isError && (
        <ErrorBanner variant={"readOnly"} error={exerciseSubmissionsQuery.error} />
      )}
      {exerciseSubmissionsQuery.isPending && <Spinner variant={"medium"} />}
      {exerciseSubmissionsQuery.isSuccess && (
        <>
          <ExerciseSubmissionList exerciseSubmissions={exerciseSubmissionsQuery.data.data} />
          <Pagination
            totalPages={exerciseSubmissionsQuery.data.total_pages}
            paginationInfo={paginationInfo}
          />
        </>
      )}
    </div>
  )
}

export default withErrorBoundary(withSignedIn(dontRenderUntilQueryParametersReady(SubmissionsPage)))
