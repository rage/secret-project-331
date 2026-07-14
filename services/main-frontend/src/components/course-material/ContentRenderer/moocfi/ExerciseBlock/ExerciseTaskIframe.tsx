"use client"

import React, { useCallback } from "react"
import { useTranslation } from "react-i18next"

import { useDialog } from "@/shared-module/common/components/dialogs/DialogProvider"
import ErrorBanner from "@/shared-module/common/components/ErrorBanner"
import ThrottledChildRenderer, {
  type ChildFactoryWithCallback,
} from "@/shared-module/common/components/ThrottledChildRenderer"
import MessageChannelIFrame from "@/shared-module/exercise-iframe-host/MessageChannelIFrame"
import type { ExerciseIframeState } from "@/shared-module/exercise-protocol/core/exercise-service-protocol-types"
import { isMessageFromIframe } from "@/shared-module/exercise-protocol/core/exercise-service-protocol-types.guard"
import {
  EXERCISE_IFRAME_QUEUE_CONFIG,
  EXERCISE_IFRAME_QUEUE_ID,
} from "@/stores/course-material/throttledRendererStore"

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
  const dialog = useDialog()

  const handleMessageFromIframe = useCallback(
    (messageContainer: unknown, _responsePort: MessagePort) => {
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
          dialog={dialog}
          {...(headingBeforeIframe !== undefined ? { headingBeforeIframe } : {})}
          url={url}
          postThisStateToIFrame={postThisStateToIFrame}
          onMessageFromIframe={handleMessageFromIframe}
          onReady={onReady}
          title={title}
        />
      )
    },
    [url, postThisStateToIFrame, handleMessageFromIframe, headingBeforeIframe, title, dialog],
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
