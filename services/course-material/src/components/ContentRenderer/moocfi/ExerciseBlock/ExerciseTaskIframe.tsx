import React, { useCallback } from "react"
import { useTranslation } from "react-i18next"

import ErrorBanner from "@/shared-module/common/components/ErrorBanner"
import MessageChannelIFrame from "@/shared-module/common/components/MessageChannelIFrame"
import ThrottledChildRenderer, {
  type ChildFactoryWithCallback,
} from "@/shared-module/common/components/ThrottledChildRenderer"
import { ExerciseIframeState } from "@/shared-module/common/exercise-service-protocol-types"
import { isMessageFromIframe } from "@/shared-module/common/exercise-service-protocol-types.guard"
import {
  EXERCISE_IFRAME_QUEUE_CONFIG,
  EXERCISE_IFRAME_QUEUE_ID,
} from "@/stores/throttledRendererStore"

interface ExerciseTaskIframeProps {
  exerciseTaskId: string
  url: string
  postThisStateToIFrame: ExerciseIframeState | null
  setAnswer: ((answer: { valid: boolean; data: unknown }) => void) | null
  title: string
  headingBeforeIframe?: string
}

const ExerciseTaskIframe: React.FC<React.PropsWithChildren<ExerciseTaskIframeProps>> = ({
  exerciseTaskId,
  url,
  postThisStateToIFrame,
  setAnswer,
  title,
  headingBeforeIframe,
}) => {
  const { t } = useTranslation()

  const handleMessageFromIframe = useCallback(
    async (messageContainer: unknown, _responsePort: MessagePort) => {
      if (!isMessageFromIframe(messageContainer)) {
        return
      }

      if (messageContainer.message === "current-state") {
        const { data, valid } = messageContainer
        if (setAnswer) {
          setAnswer({ data, valid })
        }
      }
    },
    [setAnswer],
  )

  const childFactory = useCallback<ChildFactoryWithCallback>(
    (onReady: () => void) => {
      return (
        <MessageChannelIFrame
          headingBeforeIframe={headingBeforeIframe}
          url={url}
          postThisStateToIFrame={postThisStateToIFrame}
          onMessageFromIframe={handleMessageFromIframe}
          onReady={onReady}
          title={title}
        />
      )
    },
    [url, postThisStateToIFrame, handleMessageFromIframe, headingBeforeIframe, title],
  )

  if (!url || url.trim() === "") {
    return <ErrorBanner error={t("cannot-render-exercise-task-missing-url")} variant="readOnly" />
  }

  return (
    <ThrottledChildRenderer
      qid={EXERCISE_IFRAME_QUEUE_ID}
      id={`exercise-iframe-${String(exerciseTaskId)}`}
      queueConfig={EXERCISE_IFRAME_QUEUE_CONFIG}
    >
      {childFactory}
    </ThrottledChildRenderer>
  )
}

export default ExerciseTaskIframe
