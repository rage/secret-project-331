import Link from "next/link"
import React from "react"
import { useQuery } from "react-query"

import Layout from "../../../../components/Layout"
import { fetchExerciseSubmissions } from "../../../../services/backend/exercises"
import { withSignedIn } from "../../../../shared-module/contexts/LoginStateContext"
import { wideWidthCenteredComponentStyles } from "../../../../shared-module/styles/componentStyles"
import basePath from "../../../../shared-module/utils/base-path"
import {
  dontRenderUntilQueryParametersReady,
  SimplifiedUrlQuery,
} from "../../../../shared-module/utils/dontRenderUntilQueryParametersReady"
import withErrorBoundary from "../../../../shared-module/utils/withErrorBoundary"

interface SubmissionPageProps {
  query: SimplifiedUrlQuery<"id">
}

const SubmissionsPage: React.FC<SubmissionPageProps> = ({ query }) => {
  const { data, error, isLoading } = useQuery(`exercise-${query.id}-submissions`, () =>
    fetchExerciseSubmissions(query.id),
  )

  if (error) {
    return <div>{JSON.stringify(error, undefined, 2)}</div>
  }

  if (isLoading || !data) {
    return <div>Loading...</div>
  }

  return (
    <Layout navVariant="complex">
      <div className={wideWidthCenteredComponentStyles}>
        <h4>Submissions</h4>
        <table>
          <thead>
            <tr>
              <th>Link</th>
              <th>Submission time</th>
              <th>Student</th>
              <th>Course instance</th>
              <th>Exercise task</th>
            </tr>
          </thead>
          <tbody>
            {data.data.map((x) => (
              <tr key={x.id}>
                <td>
                  <Link
                    href={{
                      pathname: "/submissions/[id]",
                      query: { id: x.id },
                    }}
                  >
                    link
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
      </div>
    </Layout>
  )
}

export default withErrorBoundary(withSignedIn(dontRenderUntilQueryParametersReady(SubmissionsPage)))
