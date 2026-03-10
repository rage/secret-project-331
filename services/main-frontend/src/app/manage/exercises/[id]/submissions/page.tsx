"use client"

import { css } from "@emotion/css"
import { useQuery } from "@tanstack/react-query"
import { useParams } from "next/navigation"
import React, { useMemo } from "react"
import { useTranslation } from "react-i18next"

import ExerciseSubmissionList from "./ExerciseSubmissionList"

import { useRegisterBreadcrumbs } from "@/components/breadcrumbs/useRegisterBreadcrumbs"
import { fetchExerciseSubmissions, getExercise } from "@/services/backend/exercises"
import DebugModal from "@/shared-module/common/components/DebugModal"
import ErrorBanner from "@/shared-module/common/components/ErrorBanner"
import Pagination from "@/shared-module/common/components/Pagination"
import Spinner from "@/shared-module/common/components/Spinner"
import { withSignedIn } from "@/shared-module/common/contexts/LoginStateContext"
import usePaginationInfo from "@/shared-module/common/hooks/usePaginationInfo"
import { fontWeights } from "@/shared-module/common/styles"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"

const SubmissionsPage: React.FC = () => {
  const { t } = useTranslation()
  const paginationInfo = usePaginationInfo()
  const { id } = useParams<{ id: string }>()

  const crumbs = useMemo(() => [{ isLoading: false as const, label: t("header-submissions") }], [t])

  useRegisterBreadcrumbs({
    key: `exercise:${id}:submissions`,
    order: 60,
    crumbs,
  })

  const exerciseQuery = useQuery({
    queryKey: [`exercise`, id],
    queryFn: () => getExercise(id),
  })

  const exerciseSubmissionsQuery = useQuery({
    queryKey: [`exercise-submissions`, id, paginationInfo.page, paginationInfo.limit],
    queryFn: () => fetchExerciseSubmissions(id, paginationInfo.page, paginationInfo.limit),
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
      {(exerciseQuery.isLoading || exerciseSubmissionsQuery.isLoading) && (
        <Spinner variant={"medium"} />
      )}
      {exerciseQuery.isSuccess &&
        exerciseSubmissionsQuery.isSuccess &&
        exerciseQuery.data.course_id && (
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

export default withErrorBoundary(withSignedIn(SubmissionsPage))
