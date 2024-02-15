import React from "react"
import { useTranslation } from "react-i18next"

import ErrorBanner from "../../../../shared-module/components/ErrorBanner"
import MessageChannelIFrame from "../../../../shared-module/components/MessageChannelIFrame"
import { IframeState } from "../../../../shared-module/exercise-service-protocol-types"
import { isMessageFromIframe } from "../../../../shared-module/exercise-service-protocol-types.guard"

interface ExerciseTaskIframeProps {
  exerciseServiceSlug: string
  url: string
  postThisStateToIFrame: IframeState | null
  setAnswer: ((answer: { valid: boolean; data: unknown }) => void) | null
  title: string
}

const ExerciseTaskIframe: React.FC<React.PropsWithChildren<ExerciseTaskIframeProps>> = ({
  url,
  postThisStateToIFrame,
  setAnswer,
  title,
}) => {
  const { t } = useTranslation()
  if (!url || url.trim() === "") {
    return <ErrorBanner error={t("cannot-render-exercise-task-missing-url")} variant="readOnly" />
  }

  return (
    <MessageChannelIFrame
      url={url}
      postThisStateToIFrame={postThisStateToIFrame}
      onMessageFromIframe={async (messageContainer, _responsePort) => {
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
