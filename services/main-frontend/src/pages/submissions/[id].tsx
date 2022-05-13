import React from "react"
import { useTranslation } from "react-i18next"
import { useQuery } from "react-query"

import Layout from "../../components/Layout"
import SubmissionIFrame from "../../components/page-specific/submissions/id/SubmissionIFrame"
import { fetchSubmissionInfo } from "../../services/backend/submissions"
import DebugModal from "../../shared-module/components/DebugModal"
import ErrorBanner from "../../shared-module/components/ErrorBanner"
import Spinner from "../../shared-module/components/Spinner"
import dontRenderUntilQueryParametersReady, {
  SimplifiedUrlQuery,
} from "../../shared-module/utils/dontRenderUntilQueryParametersReady"

interface SubmissionPageProps {
  query: SimplifiedUrlQuery<"id">
}

const Submission: React.FC<SubmissionPageProps> = ({ query }) => {
  const { t } = useTranslation()
  const getSubmissionInfo = useQuery(`submission-${query.id}`, () => fetchSubmissionInfo(query.id))

  const totalScoreGiven = getSubmissionInfo.data?.tasks
    .map((task) => task.previous_submission_grading?.score_given)
    .reduce((a, b) => (a ?? 0) + (b ?? 0), 0)
  return (
    <Layout navVariant="simple">
      <div>
        {getSubmissionInfo.isError && (
          <ErrorBanner variant={"readOnly"} error={getSubmissionInfo.error} />
        )}
        {(getSubmissionInfo.isLoading || getSubmissionInfo.isIdle) && (
          <Spinner variant={"medium"} />
        )}
        {getSubmissionInfo.isSuccess && (
          <>
            <h1>{t("title-submission-id", { id: query.id })}</h1>
            {
              <div>
                <div>
                  {t("points-out-of", {
                    points: totalScoreGiven,
                    scoreMaximum: getSubmissionInfo.data.exercise.score_maximum,
                  })}
                </div>
                <div>
                  {t("submitted-at-by", {
                    time: getSubmissionInfo.data.exercise_slide_submission.created_at.toDateString(),
                    user: getSubmissionInfo.data.exercise_slide_submission.user_id,
                  })}
                </div>
              </div>
            }
            {getSubmissionInfo.data.tasks
              .sort((a, b) => a.order_number - b.order_number)
              .map((task) => (
                <SubmissionIFrame
                  key={task.id}
                  url={`${task.exercise_iframe_url}?width=700`} // todo: move constants to shared module?
                  public_spec={task.public_spec}
                  submission={task.previous_submission}
                  model_solution_spec={task.model_solution_spec}
                  grading={task.previous_submission_grading}
                />
              ))}
          </>
        )}
        <DebugModal data={getSubmissionInfo.data} />
      </div>
    </Layout>
  )
}

export default dontRenderUntilQueryParametersReady(Submission)
