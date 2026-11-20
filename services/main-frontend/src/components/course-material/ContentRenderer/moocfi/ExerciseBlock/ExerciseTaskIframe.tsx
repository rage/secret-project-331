"use client"

import { useAtomValue } from "jotai"
import React, { useCallback } from "react"
import { useTranslation } from "react-i18next"

import {
  ThrottledChildRenderer,
  type ChildFactoryWithCallback,
} from "@/shared-module/common/components/ThrottledChildRenderer"
import { useReportExerciseIframeFailure } from "@/shared-module/common/hooks/useReportExerciseIframeFailure"
import { omitUndefined } from "@/shared-module/common/utils/nullability"
import { useDialog, ErrorNotice } from "@/shared-module/components"
import MessageChannelIFrame from "@/shared-module/exercise-iframe-host/MessageChannelIFrame"
import type {
  ExerciseIframeState,
  MessageToIframe,
} from "@/shared-module/exercise-protocol/core/exercise-service-protocol-types"
import { isMessageFromIframe } from "@/shared-module/exercise-protocol/core/exercise-service-protocol-types.guard"
import { courseMaterialAtom } from "@/state/course-material"
import {
  EXERCISE_IFRAME_QUEUE_CONFIG,
  EXERCISE_IFRAME_QUEUE_ID,
} from "@/stores/course-material/throttledRendererStore"
import type { CapturedExerciseTaskAnswer } from "@/utils/course-material/exerciseTaskAnswer"
import { uploadFilesForExerciseTaskAnswer } from "@/utils/uploadFilesFromExerciseIframe"

interface ExerciseTaskIframeProps {
  exerciseTaskId: string
  exerciseServiceSlug: string
  url: string
  postThisStateToIFrame: ExerciseIframeState | null
  setAnswer: ((answer: CapturedExerciseTaskAnswer) => void) | null
  title: string
  headingBeforeIframe?: string
  /** Names the files the iframe asks to download; see `MessageChannelIFrame`. */
  overrideDownloadFilename?: (url: string) => string
}

/**
 * Upload files on the iframe's behalf (plugins never store data themselves) and return the stored
 * ordered host-assigned id/URL entries. A logged-in student is authorized to upload files bound to
 * their own exercise task.
 */
const ExerciseTaskIframe: React.FC<React.PropsWithChildren<ExerciseTaskIframeProps>> = ({
  exerciseTaskId,
  exerciseServiceSlug,
  url,
  postThisStateToIFrame,
  setAnswer,
  title,
  headingBeforeIframe,
  overrideDownloadFilename,
}) => {
  const { t } = useTranslation()
  const dialog = useDialog()
  const courseMaterialState = useAtomValue(courseMaterialAtom)
  const failureReportHandlers = useReportExerciseIframeFailure({
    url,
    exerciseServiceSlug,
    viewType: postThisStateToIFrame?.view_type,
    courseId: courseMaterialState.course?.id,
    examId: courseMaterialState.examData?.id,
    pageId: courseMaterialState.page?.id,
    exerciseTaskId,
  })

  const handleMessageFromIframe = useCallback(
    async (messageContainer: unknown, responsePort: MessagePort) => {
      if (!isMessageFromIframe(messageContainer)) {
        return
      }

      if (messageContainer.message === "current-state") {
        const { data, valid, files, validityMessages } = messageContainer
        if (setAnswer) {
          setAnswer({ data, valid, ...omitUndefined({ files, validityMessages }) })
        }
      } else if (messageContainer.message === "file-upload") {
        let response: MessageToIframe
        try {
          const files = await uploadFilesForExerciseTaskAnswer(
            exerciseTaskId,
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
    [setAnswer, exerciseTaskId],
  )

  const childFactory = useCallback<ChildFactoryWithCallback>(
    (onReady: () => void) => {
      return (
        <MessageChannelIFrame
          dialog={dialog}
          {...omitUndefined({ headingBeforeIframe, overrideDownloadFilename })}
          url={url}
          postThisStateToIFrame={postThisStateToIFrame}
          onMessageFromIframe={handleMessageFromIframe}
          onReady={onReady}
          title={title}
          {...failureReportHandlers}
        />
      )
    },
    [
      url,
      postThisStateToIFrame,
      handleMessageFromIframe,
      headingBeforeIframe,
      title,
      dialog,
      overrideDownloadFilename,
      failureReportHandlers,
    ],
  )

  if (!url || url.trim() === "") {
    return <ErrorNotice error={t("cannot-render-exercise-task-missing-url")} />
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
