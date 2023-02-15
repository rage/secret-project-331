import { Alert } from "@mui/lab"
import React from "react"
import { useTranslation } from "react-i18next"

import MessageChannelIFrame from "../../../../shared-module/components/MessageChannelIFrame"
import { IframeState } from "../../../../shared-module/exercise-service-protocol-types"
import { isMessageFromIframe } from "../../../../shared-module/exercise-service-protocol-types.guard"

interface ExerciseTaskIframeProps {
  exerciseServiceSlug: string
  url: string
  postThisStateToIFrame: IframeState | null
  setAnswer: ((answer: { valid: boolean; data: unknown }) => void) | null
  title: string
  iframeId?: string
}

const ExerciseTaskIframe: React.FC<React.PropsWithChildren<ExerciseTaskIframeProps>> = ({
  url,
  postThisStateToIFrame,
  setAnswer,
  title,
  iframeId,
}) => {
  const { t } = useTranslation()
  if (!url || url.trim() === "") {
    return <Alert severity="error">{t("cannot-render-exercise-task-missing-url")}</Alert>
  }

  return (
    <MessageChannelIFrame
      url={url}
      id={iframeId}
      postThisStateToIFrame={postThisStateToIFrame}
      onMessageFromIframe={async (messageContainer, _responsePort) => {
        console.log(messageContainer)
        if (isMessageFromIframe(messageContainer)) {
          if (messageContainer.message === "current-state") {
            const { data, valid } = messageContainer
            if (setAnswer) {
              setAnswer({ data, valid })
            }
          }
        }
      }}
      title={title}
    />
  )
}

export default ExerciseTaskIframe
