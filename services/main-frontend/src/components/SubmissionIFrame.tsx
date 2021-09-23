import { Alert } from "@material-ui/lab"
import React from "react"
import { useTranslation } from "react-i18next"

import { Submission } from "../shared-module/bindings"
import MessageChannelIFrame from "../shared-module/components/MessageChannelIFrame"

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
      onCommunicationChannelEstabilished={(port) => {
        // eslint-disable-next-line i18next/no-literal-string
        console.log("posting " + JSON.stringify(state))
        port.postMessage({ message: "set-state", data: state })
      }}
      onMessageFromIframe={(messageContainer, _responsePort) => {
        console.log(messageContainer)
      }}
    />
  )
}

export default SubmissionIFrame
