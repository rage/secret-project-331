import { css } from "@emotion/css"
import { useQuery } from "@tanstack/react-query"
import React from "react"
import { useTranslation } from "react-i18next"

import ExerciseSubmissionList from "../../../../components/page-specific/manage/exercises/id/submissions/ExerciseSubmissionList"
import { fetchExerciseSubmissions, getExercise } from "../../../../services/backend/exercises"

import DebugModal from "@/shared-module/common/components/DebugModal"
import ErrorBanner from "@/shared-module/common/components/ErrorBanner"
import Pagination from "@/shared-module/common/components/Pagination"
import Spinner from "@/shared-module/common/components/Spinner"
import { withSignedIn } from "@/shared-module/common/contexts/LoginStateContext"
import usePaginationInfo from "@/shared-module/common/hooks/usePaginationInfo"
import { fontWeights } from "@/shared-module/common/styles"
import {
  dontRenderUntilQueryParametersReady,
  SimplifiedUrlQuery,
} from "@/shared-module/common/utils/dontRenderUntilQueryParametersReady"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"

interface SubmissionPageProps {
  query: SimplifiedUrlQuery<"id">
}

const SubmissionsPage: React.FC<React.PropsWithChildren<SubmissionPageProps>> = ({ query }) => {
  const { t } = useTranslation()
  const paginationInfo = usePaginationInfo()

  const exerciseQuery = useQuery({
    queryKey: [`exercise`, query.id],
    queryFn: () => getExercise(query.id),
  })

  const exerciseSubmissionsQuery = useQuery({
    queryKey: [`exercise-submissions`, query.id, paginationInfo.page, paginationInfo.limit],
    queryFn: () => fetchExerciseSubmissions(query.id, paginationInfo.page, paginationInfo.limit),
  })

  return (
    <div>
      <div
        className={css`
          display: flex;
          align-items: center;
          gap: 0.5rem;
          margin-bottom: 1rem;
        `}
      >
        <h3
          className={css`
            font-weight: ${fontWeights.medium};
            margin: 0;
          `}
        >
          {t("header-submissions")}
        </h3>
        {exerciseSubmissionsQuery.isSuccess && (
          <DebugModal
            variant="minimal"
            data={exerciseSubmissionsQuery.data}
            buttonWrapperStyles={css`
              display: flex;
              align-items: center;
            `}
          />
        )}
      </div>
      {(exerciseQuery.isError || exerciseSubmissionsQuery.isError) && (
        <ErrorBanner
          variant={"readOnly"}
          error={exerciseQuery.error || exerciseSubmissionsQuery.error}
        />
      )}
      {(exerciseQuery.isPending || exerciseSubmissionsQuery.isPending) && (
        <Spinner variant={"medium"} />
      )}
      {exerciseQuery.isSuccess && exerciseSubmissionsQuery.isSuccess && (
        <>
          <ExerciseSubmissionList
            exerciseSubmissions={exerciseSubmissionsQuery.data.data}
            courseId={exerciseQuery.data.course_id}
          />
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
