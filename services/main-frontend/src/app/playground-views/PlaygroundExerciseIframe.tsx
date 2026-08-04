"use client"

import { css } from "@emotion/css"
import type { UseQueryResult } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"

import { useDialog } from "@/shared-module/common/components/dialogs/DialogProvider"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"
import MessageChannelIFrame from "@/shared-module/exercise-iframe-host/MessageChannelIFrame"
import type {
  CurrentStateMessage,
  ExerciseIframeState,
  MessageToIframe,
  UserInformation,
} from "@/shared-module/exercise-protocol/core/exercise-service-protocol-types"
import { isMessageFromIframe } from "@/shared-module/exercise-protocol/core/exercise-service-protocol-types.guard"
import { uploadFilesFromExerciseIframe } from "@/utils/uploadFilesFromExerciseIframe"

interface PlaygroundExerciseIframeProps {
  url: string
  publicSpecQuery: UseQueryResult<unknown, unknown>
  userAnswer: unknown
  setCurrentStateReceivedFromIframe: React.Dispatch<
    React.SetStateAction<CurrentStateMessage | null>
  >
  showIframeBorders: boolean
  disableSandbox: boolean
  userInformation: UserInformation
}

const EXAMPLE_UUID = "886d57ba-4c88-4d88-9057-5e88f35ae25f"
const TITLE = "PLAYGROUND"

const PlaygroundExerciseIframe: React.FC<
  React.PropsWithChildren<PlaygroundExerciseIframeProps>
> = ({
  url,
  publicSpecQuery,
  setCurrentStateReceivedFromIframe,
  showIframeBorders,
  disableSandbox,
  userInformation,
  userAnswer,
}) => {
  const { t } = useTranslation()
  const dialog = useDialog()
  if (publicSpecQuery.isLoading || publicSpecQuery.isError) {
    return <div>{t("error-no-public-spec")}</div>
  }
  // Makes sure the iframe renders again when the data changes
  const iframeKey =
    url +
    JSON.stringify(publicSpecQuery.data) +
    disableSandbox +
    JSON.stringify(userAnswer) +
    JSON.stringify(userInformation)
  return (
    <div
      className={css`
        margin-top: 1rem;
      `}
    >
      <MessageChannelIFrame
        dialog={dialog}
        key={iframeKey}
        url={url}
        postThisStateToIFrame={
          {
            // oxlint-disable-next-line i18next/no-literal-string
            view_type: "answer-exercise",
            exercise_task_id: EXAMPLE_UUID,
            user_information: userInformation,
            data: {
              public_spec: publicSpecQuery.data,
              previous_submission: userAnswer,
            },
          } as ExerciseIframeState
        }
        onMessageFromIframe={async (msg, responsePort) => {
          if (isMessageFromIframe(msg)) {
            if (msg.message === "current-state") {
              setCurrentStateReceivedFromIframe(msg)
            } else if (msg.message === "file-upload") {
              let response: MessageToIframe
              try {
                const files = await uploadFilesFromExerciseIframe("playground", msg.files)
                response = {
                  // oxlint-disable-next-line i18next/no-literal-string
                  message: "upload-result",
                  requestId: msg.requestId,
                  success: true,
                  files,
                }
              } catch (e) {
                response = {
                  // oxlint-disable-next-line i18next/no-literal-string
                  message: "upload-result",
                  requestId: msg.requestId,
                  success: false,
                  error: e instanceof Error ? e.message : String(e),
                }
              }
              // oxlint-disable-next-line unicorn/require-post-message-target-origin -- postMessage 2nd arg is transferables, not targetOrigin
              responsePort.postMessage(response)
            }
          }
        }}
        title={TITLE}
        showBorders={showIframeBorders}
        disableSandbox={disableSandbox}
      />
    </div>
  )
}

export default withErrorBoundary(PlaygroundExerciseIframe)
