import React from "react"
import { useQuery } from "react-query"

import Layout from "../../components/Layout"
import SubmissionIFrame from "../../components/SubmissionIFrame"
import { fetchSubmissionInfo } from "../../services/backend/submissions"
import DebugModal from "../../shared-module/components/DebugModal"
import { normalWidthCenteredComponentStyles } from "../../shared-module/styles/componentStyles"
import dontRenderUntilQueryParametersReady, {
  SimplifiedUrlQuery,
} from "../../shared-module/utils/dontRenderUntilQueryParametersReady"

interface SubmissionPageProps {
  query: SimplifiedUrlQuery<"id">
}

const Submission: React.FC<SubmissionPageProps> = ({ query }) => {
  const { isLoading, error, data } = useQuery(`submission-${query.id}`, () =>
    fetchSubmissionInfo(query.id),
  )

  if (error) {
    return <pre>{JSON.stringify(error, undefined, 2)}</pre>
  }

  if (isLoading || !data) {
    return <>Loading...</>
  }

  let grading = <></>
  if (data.grading) {
    grading = (
      <div>
        <div>
          Points: {data.grading.score_given} out of {data.exercise.score_maximum}
        </div>
        <div>
          Submitted at {data.submission.created_at.toDateString()} by {data.submission.user_id}
        </div>
      </div>
    )
  }

  return (
    <Layout navVariant="complex">
      <div className={normalWidthCenteredComponentStyles}>
        <h1>Submission {data.submission.id}</h1>
        {grading}
        <SubmissionIFrame
          url={`${data.submission_iframe_path}?width=700`} // todo: move constants to shared module?
          public_spec={data.exercise_task.public_spec}
          submission={data.submission}
          model_solution_spec={data.exercise_task.model_solution_spec}
        />
        <DebugModal data={data} />
      </div>
    </Layout>
  )
}

export default dontRenderUntilQueryParametersReady(Submission)
