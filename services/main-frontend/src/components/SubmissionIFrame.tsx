import { Alert } from "@material-ui/lab"
import React from "react"
import { useTranslation } from "react-i18next"

import { Submission } from "../shared-module/bindings"
import MessageChannelIFrame from "../shared-module/components/MessageChannelIFrame"

const VIEW_SUBMISSION = "view-submission"
interface SubmissionIFrameProps {
  url: string
  public_spec: unknown
  submission: Submission
  model_solution_spec: unknown
}

interface SubmissionState {
  public_spec: unknown
  submission_data: unknown
  model_solution_spec: unknown
}

const SubmissionIFrame: React.FC<SubmissionIFrameProps> = ({
  url,
  public_spec,
  submission,
  model_solution_spec,
}) => {
  const { t } = useTranslation()
  if (!url || url.trim() === "") {
    return <Alert severity="error">{t("error-cannot-render-exercise-task-missing-url")}</Alert>
  }

  const state: SubmissionState = {
    public_spec,
    model_solution_spec,
    submission_data: submission.data_json,
  }

  return (
    <MessageChannelIFrame
      url={url}
      onMessageFromIframe={(messageContainer, _responsePort) => {
        console.log(messageContainer)
      }}
      postThisStateToIFrame={{ view_type: VIEW_SUBMISSION, data: state }}
    />
  )
}

export default SubmissionIFrame
