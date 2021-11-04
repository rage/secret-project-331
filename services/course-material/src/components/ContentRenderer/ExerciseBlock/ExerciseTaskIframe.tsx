import { Alert } from "@material-ui/lab"
import React, { Dispatch } from "react"
import { useTranslation } from "react-i18next"

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
  const { t } = useTranslation()
  if (!url || url.trim() === "") {
    return <Alert severity="error">{t("cannot-render-exercise-task-missing-url")}</Alert>
  }

  return (
    <MessageChannelIFrame
      url={url}
      onCommunicationChannelEstabilished={(port) => {
        // eslint-disable-next-line i18next/no-literal-string
        const message: SetStateMessage = { message: "set-state", view_type: "exercise", data }
        port.postMessage(message)
      }}
      onMessageFromIframe={(messageContainer, _responsePort) => {
        if (isCurrentStateMessage(messageContainer)) {
          setAnswer(messageContainer.data)
          setAnswerValid(messageContainer.valid)
        } else {
          // eslint-disable-next-line i18next/no-literal-string
          console.error("Unexpected message or structure is not valid.")
        }
      }}
    />
  )
}

export default ExerciseTaskIframe
