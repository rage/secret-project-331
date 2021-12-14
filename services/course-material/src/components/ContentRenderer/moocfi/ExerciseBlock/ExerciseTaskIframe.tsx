import { Alert } from "@material-ui/lab"
import React, { Dispatch } from "react"
import { useTranslation } from "react-i18next"

import MessageChannelIFrame from "../../../../shared-module/components/MessageChannelIFrame"
import { IframeState } from "../../../../shared-module/iframe-protocol-types"

interface ExerciseTaskIframeProps {
  url: string
  postThisStateToIFrame: IframeState | null
  setAnswer: Dispatch<unknown>
  setAnswerValid: Dispatch<boolean>
}

const ExerciseTaskIframe: React.FC<ExerciseTaskIframeProps> = ({
  url,
  postThisStateToIFrame,
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
      postThisStateToIFrame={postThisStateToIFrame}
      onMessageFromIframe={(messageContainer, _responsePort) => {
        console.log(messageContainer)
        setAnswer(messageContainer.data)
        setAnswerValid(messageContainer.valid)
      }}
    />
  )
}

export default ExerciseTaskIframe
