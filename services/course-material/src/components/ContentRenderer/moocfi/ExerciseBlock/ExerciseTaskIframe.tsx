import React from "react"
import { useTranslation } from "react-i18next"

import { checkTestRun, runBrowserTests } from "@/services/tmc"
import ErrorBanner from "@/shared-module/common/components/ErrorBanner"
import MessageChannelIFrame from "@/shared-module/common/components/MessageChannelIFrame"
import {
  ExerciseIframeState,
  MessageToIframe,
} from "@/shared-module/common/exercise-service-protocol-types"
import { isMessageFromIframe } from "@/shared-module/common/exercise-service-protocol-types.guard"

interface ExerciseTaskIframeProps {
  exerciseServiceSlug: string
  url: string
  postThisStateToIFrame: ExerciseIframeState | null
  setAnswer: ((answer: { valid: boolean; data: unknown }) => void) | null
  title: string
  headingBeforeIframe?: string
}

const ExerciseTaskIframe: React.FC<React.PropsWithChildren<ExerciseTaskIframeProps>> = ({
  url,
  postThisStateToIFrame,
  setAnswer,
  title,
  headingBeforeIframe,
}) => {
  const { t } = useTranslation()
  if (!url || url.trim() === "") {
    return <ErrorBanner error={t("cannot-render-exercise-task-missing-url")} variant="readOnly" />
  }

  return (
    <MessageChannelIFrame
      headingBeforeIframe={headingBeforeIframe}
      url={url}
      postThisStateToIFrame={postThisStateToIFrame}
      onMessageFromIframe={async (messageContainer, responsePort) => {
        if (isMessageFromIframe(messageContainer)) {
          if (messageContainer.message === "current-state") {
            const { data, valid } = messageContainer
            if (setAnswer) {
              setAnswer({ data, valid })
            }
          }
          if (messageContainer.message === "test-request") {
            console.log("Received test request")
            const testRunId = await runBrowserTests(
              messageContainer.archiveDownloadUrl,
              messageContainer.files[0].filepath,
              messageContainer.files[0].contents,
            )
            // monitor the test run and return results when finished
            while (true) {
              const result = await checkTestRun(testRunId)
              if (result !== null) {
                // got something
                const testResultsMessage: MessageToIframe = {
                  // eslint-disable-next-line i18next/no-literal-string
                  message: "test-results",
                  test_result: result,
                }
                responsePort.postMessage(testResultsMessage)
                break
              }
              // else wait a second and repeat
              const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))
              await delay(1000)
            }
          }
        }
      }}
      title={title}
    />
  )
}

export default ExerciseTaskIframe
