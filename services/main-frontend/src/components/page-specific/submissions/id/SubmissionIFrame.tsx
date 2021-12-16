import { Alert } from "@material-ui/lab"
import React from "react"
import { useTranslation } from "react-i18next"

import { Grading, Submission, SubmissionResult } from "../../../../shared-module/bindings"
import MessageChannelIFrame from "../../../../shared-module/components/MessageChannelIFrame"

const VIEW_SUBMISSION = "view-submission"
interface SubmissionIFrameProps {
  url: string
  public_spec: unknown
  submission: Submission
  model_solution_spec: unknown
  grading: Grading | null
}

interface SubmissionState {
  submission_result: SubmissionResult
  user_answer: unknown
  public_spec: unknown
}

const SubmissionIFrame: React.FC<SubmissionIFrameProps> = ({
  url,
  public_spec,
  submission,
  model_solution_spec,
  grading,
}) => {
  const { t } = useTranslation()
  if (!url || url.trim() === "") {
    return <Alert severity="error">{t("error-cannot-render-exercise-task-missing-url")}</Alert>
  }
  if (!grading) {
    return <Alert severity="error">{t("error-cannot-render-exercise-task-missing-url")}</Alert>
  }
  const state: SubmissionState = {
    public_spec,
    submission_result: {
      submission,
      grading,
      model_solution_spec,
    },
    user_answer: submission.data_json,
  }

  return (
    <MessageChannelIFrame
      url={url}
      onMessageFromIframe={(messageContainer, _responsePort) => {
        console.log(messageContainer)
      }}
      postThisStateToIFrame={{
        view_type: VIEW_SUBMISSION,
        data: {
          public_spec: state.public_spec,
          user_answer: state.user_answer,
          model_solution_spec: state.submission_result.model_solution_spec,
          grading: state.submission_result.grading,
        },
      }}
    />
  )
}

export default SubmissionIFrame
