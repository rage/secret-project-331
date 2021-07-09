import { Alert } from "@material-ui/lab"
import React, { Dispatch } from "react"

import MessageChannelIFrame from "../../../shared-module/components/MessageChannelIFrame"

interface ExerciseTaskIframeProps {
  url: string
  public_spec: unknown
  setAnswer: Dispatch<unknown>
}

const ExerciseTaskIframe: React.FC<ExerciseTaskIframeProps> = ({ url, public_spec, setAnswer }) => {
  if (!url || url.trim() === "") {
    return <Alert severity="error">Cannot render exercise task, missing url.</Alert>
  }
  return (
    <MessageChannelIFrame
      url={url}
      onCommunicationChannelEstabilished={(port) => {
        port.postMessage({ message: "set-state", data: public_spec })
      }}
      onMessageFromIframe={(messageContainer, _responsePort) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const uncheckedMessage = (messageContainer as any).message
        if (!uncheckedMessage) {
          console.error("Invalid message. No message field")
          return
        }
        if (uncheckedMessage === "current-state") {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const uncheckedData = (messageContainer as any).data
          setAnswer(uncheckedData)
        }
      }}
    />
  )
}

export default ExerciseTaskIframe
