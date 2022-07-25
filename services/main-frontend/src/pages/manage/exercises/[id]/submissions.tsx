import { useQuery } from "@tanstack/react-query"
import React from "react"
import { useTranslation } from "react-i18next"

import Layout from "../../../../components/Layout"
import ExerciseSubmissionList from "../../../../components/page-specific/manage/exercises/id/submissions/ExerciseSubmissionList"
import { fetchExerciseSubmissions } from "../../../../services/backend/exercises"
import ErrorBanner from "../../../../shared-module/components/ErrorBanner"
import Spinner from "../../../../shared-module/components/Spinner"
import { withSignedIn } from "../../../../shared-module/contexts/LoginStateContext"
import {
  dontRenderUntilQueryParametersReady,
  SimplifiedUrlQuery,
} from "../../../../shared-module/utils/dontRenderUntilQueryParametersReady"
import withErrorBoundary from "../../../../shared-module/utils/withErrorBoundary"

interface SubmissionPageProps {
  query: SimplifiedUrlQuery<"id">
}

const SubmissionsPage: React.FC<SubmissionPageProps> = ({ query }) => {
  const { t } = useTranslation()
  const getExerciseSubmissions = useQuery([`exercise-${query.id}-submissions`], () =>
    fetchExerciseSubmissions(query.id))

  return (
    <Layout navVariant="simple">
      <div>
        <h4>{t("header-submissions")}</h4>
        {getExerciseSubmissions.isError && (
          <ErrorBanner variant={"readOnly"} error={getExerciseSubmissions.error} />
        )}
        {(getExerciseSubmissions.isLoading || getExerciseSubmissions.isIdle) && (
          <Spinner variant={"medium"} />
        )}
        {getExerciseSubmissions.isSuccess && (
          <ExerciseSubmissionList exerciseSubmissions={getExerciseSubmissions.data.data} />
        )}
      </div>
    </Layout>
  )
}

export default withErrorBoundary(withSignedIn(dontRenderUntilQueryParametersReady(SubmissionsPage)))
