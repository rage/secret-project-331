import { Alert } from "@material-ui/lab"
import React from "react"

import { Submission } from "../services/services.types"
import MessageChannelIFrame from "../shared-module/components/MessageChannelIFrame"

interface SubmissionIFrameProps {
  url: string
  public_spec: unknown
  submission: Submission
}

interface SubmissionState {
  public_spec: unknown
  submission_data: unknown
}

const SubmissionIFrame: React.FC<SubmissionIFrameProps> = ({ url, public_spec, submission }) => {
  if (!url || url.trim() === "") {
    return <Alert severity="error">Cannot render exercise task, missing url.</Alert>
  }

  const state: SubmissionState = {
    public_spec,
    submission_data: submission.data_json,
  }

  return (
    <MessageChannelIFrame
      url={url}
      onCommunicationChannelEstabilished={(port) => {
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
