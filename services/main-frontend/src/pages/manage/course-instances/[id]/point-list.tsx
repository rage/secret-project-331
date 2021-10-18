import { css } from "@emotion/css"
import React from "react"
import { useQuery } from "react-query"

import Layout from "../../../../components/Layout"
import { getPoints } from "../../../../services/backend/course-instances"
import { isErrorResponse } from "../../../../shared-module/bindings.guard"
import { withSignedIn } from "../../../../shared-module/contexts/LoginStateContext"
import { normalWidthCenteredComponentStyles } from "../../../../shared-module/styles/componentStyles"
import dontRenderUntilQueryParametersReady, {
  SimplifiedUrlQuery,
} from "../../../../shared-module/utils/dontRenderUntilQueryParametersReady"
import withErrorBoundary from "../../../../shared-module/utils/withErrorBoundary"

export interface PointListProps {
  query: SimplifiedUrlQuery<"id">
}

const PointList: React.FC<PointListProps> = ({ query }) => {
  const courseInstanceId = query.id

  const { isLoading, error, data } = useQuery(`point-list-${courseInstanceId}`, () =>
    getPoints(courseInstanceId),
  )

  if (error) {
    let message
    if (isErrorResponse(error)) {
      message = `Failed to fetch points: ${error.message}`
    } else {
      message = `Unexpected error while fetching points: ${JSON.stringify(error)}`
    }
    return (
      <div>
        <h1>Error</h1>
        <pre>{message}</pre>
      </div>
    )
  }

  if (isLoading || !data) {
    return <div>Loading page...</div>
  }

  const total = data.exercises.map((e) => e.score_maximum).reduce((prev, curr) => prev + curr)
  return (
    <Layout navVariant="complex">
      <div
        className={css`
          ${normalWidthCenteredComponentStyles}
        `}
      >
        <h2>Exercise point list</h2>
        <table>
          <tr>
            <th>User</th>
            {data.exercises.map((e) => (
              <th key={e.id}>{e.name}</th>
            ))}
            <th>Total out of {total}</th>
          </tr>
          {data.users.map((u) => {
            let total = 0
            return (
              <tr key={u}>
                <th>{u}</th>
                {data.exercises.map((e) => {
                  let points = 0
                  const exercisePoints: Record<string, number> | undefined =
                    data.user_exercise_points[u]
                  if (exercisePoints) {
                    points = exercisePoints[e.id] || 0
                    total += points
                  }
                  return <th key={e.id + u}>{points}</th>
                })}
                <th>{total.toFixed(2)}</th>
              </tr>
            )
          })}
        </table>
      </div>
    </Layout>
  )
}

export default withErrorBoundary(withSignedIn(dontRenderUntilQueryParametersReady(PointList)))
