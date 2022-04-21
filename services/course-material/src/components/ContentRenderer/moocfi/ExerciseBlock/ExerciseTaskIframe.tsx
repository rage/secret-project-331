import { Alert } from "@mui/lab"
import React from "react"
import { useTranslation } from "react-i18next"

import MessageChannelIFrame from "../../../../shared-module/components/MessageChannelIFrame"
import { IframeState } from "../../../../shared-module/iframe-protocol-types"

interface ExerciseTaskIframeProps {
  url: string
  postThisStateToIFrame: IframeState | null
  setAnswer: (answer: { valid: boolean; data: unknown }) => void
  title: string
}

const ExerciseTaskIframe: React.FC<ExerciseTaskIframeProps> = ({
  url,
  postThisStateToIFrame,
  setAnswer,
  title,
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
        const { data, valid } = messageContainer
        setAnswer({ data, valid })
      }}
      title={title}
    />
  )
}

export default ExerciseTaskIframe
