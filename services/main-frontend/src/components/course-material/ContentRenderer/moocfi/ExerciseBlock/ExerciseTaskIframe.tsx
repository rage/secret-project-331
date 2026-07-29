"use client"

import React, { useCallback } from "react"
import { useTranslation } from "react-i18next"

import { useDialog } from "@/shared-module/common/components/dialogs/DialogProvider"
import ErrorBanner from "@/shared-module/common/components/ErrorBanner"
import ThrottledChildRenderer, {
  type ChildFactoryWithCallback,
} from "@/shared-module/common/components/ThrottledChildRenderer"
import { omitUndefined } from "@/shared-module/common/utils/nullability"
import MessageChannelIFrame from "@/shared-module/exercise-iframe-host/MessageChannelIFrame"
import type {
  ExerciseIframeState,
  MessageToIframe,
} from "@/shared-module/exercise-protocol/core/exercise-service-protocol-types"
import { isMessageFromIframe } from "@/shared-module/exercise-protocol/core/exercise-service-protocol-types.guard"
import {
  EXERCISE_IFRAME_QUEUE_CONFIG,
  EXERCISE_IFRAME_QUEUE_ID,
} from "@/stores/course-material/throttledRendererStore"
import { uploadFilesFromExerciseIframe } from "@/utils/uploadFilesFromExerciseIframe"

interface ExerciseTaskIframeProps {
  exerciseTaskId: string
  exerciseServiceSlug: string
  url: string
  postThisStateToIFrame: ExerciseIframeState | null
  setAnswer:
    | ((answer: { valid: boolean; data: unknown; validityMessages?: string[] }) => void)
    | null
  title: string
  headingBeforeIframe?: string
}

/**
 * Upload files on the iframe's behalf (plugins never store data themselves) and return the stored
 * ordered host-assigned id/URL entries. A logged-in student is authorized to upload to the exercise
 * service's slug.
 */
const ExerciseTaskIframe: React.FC<React.PropsWithChildren<ExerciseTaskIframeProps>> = ({
  exerciseTaskId,
  exerciseServiceSlug,
  url,
  postThisStateToIFrame,
  setAnswer,
  title,
  headingBeforeIframe,
}) => {
  const { t } = useTranslation()
  const dialog = useDialog()

  const handleMessageFromIframe = useCallback(
    async (messageContainer: unknown, responsePort: MessagePort) => {
      if (!isMessageFromIframe(messageContainer)) {
        return
      }

      if (messageContainer.message === "current-state") {
        const { data, valid, validityMessages } = messageContainer
        if (setAnswer) {
          setAnswer({ data, valid, ...omitUndefined({ validityMessages }) })
        }
      } else if (messageContainer.message === "file-upload") {
        let response: MessageToIframe
        try {
          const files = await uploadFilesFromExerciseIframe(
            exerciseServiceSlug,
            messageContainer.files,
          )
          response = {
            // oxlint-disable-next-line i18next/no-literal-string
            message: "upload-result",
            requestId: messageContainer.requestId,
            success: true,
            files,
          }
        } catch (e) {
          response = {
            // oxlint-disable-next-line i18next/no-literal-string
            message: "upload-result",
            requestId: messageContainer.requestId,
            success: false,
            error: e instanceof Error ? e.message : String(e),
          }
        }
        // oxlint-disable-next-line unicorn/require-post-message-target-origin -- MessagePort.postMessage takes no targetOrigin
        responsePort.postMessage(response)
      }
    },
    [setAnswer, exerciseServiceSlug],
  )

  const childFactory = useCallback<ChildFactoryWithCallback>(
    (onReady: () => void) => {
      return (
        <MessageChannelIFrame
          dialog={dialog}
          {...omitUndefined({ headingBeforeIframe })}
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
