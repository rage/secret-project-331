import Link from "next/link"
import React from "react"
import { useTranslation } from "react-i18next"
import { useQuery } from "react-query"

import Layout from "../../../../components/Layout"
import { fetchExerciseSubmissions } from "../../../../services/backend/exercises"
import ErrorBanner from "../../../../shared-module/components/ErrorBanner"
import Spinner from "../../../../shared-module/components/Spinner"
import { withSignedIn } from "../../../../shared-module/contexts/LoginStateContext"
import { frontendWideWidthCenteredComponentStyles } from "../../../../shared-module/styles/componentStyles"
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
  const getExerciseSubmissions = useQuery(`exercise-${query.id}-submissions`, () =>
    fetchExerciseSubmissions(query.id),
  )

  return (
    <Layout navVariant="complex">
      <div className={frontendWideWidthCenteredComponentStyles}>
        <h4>{t("header-submissions")}</h4>
        {getExerciseSubmissions.isError && (
          <ErrorBanner variant={"readOnly"} error={getExerciseSubmissions.error} />
        )}
        {getExerciseSubmissions.isLoading && <Spinner variant={"medium"} />}
        {getExerciseSubmissions.isSuccess && getExerciseSubmissions.data.data.length !== 0 ? (
          <>
            <table>
              <thead>
                <tr>
                  <th>{t("label-link")}</th>
                  <th>{t("label-submission-time")}</th>
                  <th>{t("label-student")}</th>
                  <th>{t("label-course-instance")}</th>
                  <th>{t("label-exercise-task")}</th>
                </tr>
              </thead>
              <tbody>
                {getExerciseSubmissions.data.data.map((x) => (
                  <tr key={x.id}>
                    <td>
                      <Link
                        href={{
                          pathname: "/submissions/[id]",
                          query: { id: x.id },
                        }}
                      >
                        {t("link")}
                      </Link>
                    </td>
                    <td>{x.created_at.toISOString()}</td>
                    <td>{x.user_id}</td>
                    <td>{x.course_instance_id}</td>
                    <td>{x.exercise_task_id}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        ) : (
          <div>{t("no-submissions")}</div>
        )}
      </div>
    </Layout>
  )
}

export default withErrorBoundary(withSignedIn(dontRenderUntilQueryParametersReady(SubmissionsPage)))
