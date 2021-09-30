import { Alert } from "@material-ui/lab"
import React from "react"

import { Submission } from "../shared-module/bindings"
import MessageChannelIFrame from "../shared-module/components/MessageChannelIFrame"
import { SetStateMessage } from "../shared-module/iframe-protocol-types"

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
  if (!url || url.trim() === "") {
    return <Alert severity="error">Cannot render exercise task, missing url.</Alert>
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
        console.log("posting " + JSON.stringify(state))
        const message: SetStateMessage = { message: "set-state", data: state }
        port.postMessage(message)
      }}
      onMessageFromIframe={(messageContainer, _responsePort) => {
        console.log(messageContainer)
      }}
    />
  )
}

export default SubmissionIFrame
