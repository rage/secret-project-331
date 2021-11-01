import { Alert } from "@material-ui/lab"
import React, { Dispatch } from "react"

import MessageChannelIFrame from "../../../shared-module/components/MessageChannelIFrame"
import { SetStateMessage } from "../../../shared-module/iframe-protocol-types"
import { isCurrentStateMessage } from "../../../shared-module/iframe-protocol-types.guard"

interface ExerciseTaskIframeProps {
  url: string
  data: unknown
  setAnswer: Dispatch<unknown>
  setAnswerValid: Dispatch<boolean>
}

const ExerciseTaskIframe: React.FC<ExerciseTaskIframeProps> = ({
  url,
  data,
  setAnswer,
  setAnswerValid,
}) => {
  if (!url || url.trim() === "") {
    return <Alert severity="error">Cannot render exercise task, missing url.</Alert>
  }

  return (
    <MessageChannelIFrame
      url={url}
      onCommunicationChannelEstabilished={(port) => {
        const message: SetStateMessage = { message: "set-state", view_type: "exercise", data }
        port.postMessage(message)
      }}
      onMessageFromIframe={(messageContainer, _responsePort) => {
        if (isCurrentStateMessage(messageContainer)) {
          setAnswer(messageContainer.data)
          setAnswerValid(messageContainer.valid)
        } else {
          console.error("Unexpected message or structure is not valid.")
        }
      }}
    />
  )
}

export default ExerciseTaskIframe
