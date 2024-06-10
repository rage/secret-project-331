import { css } from "@emotion/css"
import { UseQueryResult } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"

import { uploadFilesFromIframe } from "../../../services/backend/playground-examples"

import MessageChannelIFrame from "@/shared-module/common/components/MessageChannelIFrame"
import {
  CurrentStateMessage,
  ExerciseIframeState,
  MessageToIframe,
  UserInformation,
} from "@/shared-module/common/exercise-service-protocol-types"
import { isMessageFromIframe } from "@/shared-module/common/exercise-service-protocol-types.guard"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"

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
  if (publicSpecQuery.isPending || publicSpecQuery.isError) {
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
        key={iframeKey}
        url={url}
        postThisStateToIFrame={
          {
            // eslint-disable-next-line i18next/no-literal-string
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
              const files = await uploadFilesFromIframe(msg.files)
              let response: MessageToIframe
              try {
                response = {
                  // eslint-disable-next-line i18next/no-literal-string
                  message: "upload-result",
                  success: true,
                  urls: files,
                }
              } catch (e) {
                response = {
                  // eslint-disable-next-line i18next/no-literal-string
                  message: "upload-result",
                  success: false,
                  error: JSON.stringify(e, null, 2),
                }
              }
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
