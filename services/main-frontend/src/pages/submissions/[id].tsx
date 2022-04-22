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
            <h1>{t("title-submission-id", { id: getSubmissionInfo.data.submission.id })}</h1>
            {
              <div>
                <div>
                  {t("points-out-of", {
                    points: getSubmissionInfo.data.grading
                      ? getSubmissionInfo.data.grading.score_given
                      : 0,
                    scoreMaximum: getSubmissionInfo.data.exercise.score_maximum,
                  })}
                </div>
                <div>
                  {t("submitted-at-by", {
                    time: getSubmissionInfo.data.submission.created_at.toDateString(),
                    user: "TODO: fix later",
                  })}
                </div>
              </div>
            }
            <SubmissionIFrame
              url={`${getSubmissionInfo.data.iframe_path}?width=700`} // todo: move constants to shared module?
              public_spec={getSubmissionInfo.data.exercise_task.public_spec}
              submission={getSubmissionInfo.data.submission}
              model_solution_spec={getSubmissionInfo.data.exercise_task.model_solution_spec}
              grading={getSubmissionInfo.data.grading}
            />
          </>
        )}
        <DebugModal data={getSubmissionInfo.data} />
      </div>
    </Layout>
  )
}

export default dontRenderUntilQueryParametersReady(Submission)
