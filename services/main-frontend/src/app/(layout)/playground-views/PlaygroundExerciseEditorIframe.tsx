"use client"

import { css } from "@emotion/css"

import { useDialog } from "@/shared-module/common/components/dialogs/DialogProvider"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"
import MessageChannelIFrame from "@/shared-module/exercise-iframe-host/MessageChannelIFrame"
import type {
  CurrentStateMessage,
  MessageToIframe,
  UserInformation,
} from "@/shared-module/exercise-protocol/core/exercise-service-protocol-types"
import { isMessageFromIframe } from "@/shared-module/exercise-protocol/core/exercise-service-protocol-types.guard"
import type { RepositoryExercise } from "@/utils/playgroundSchemas"
import { uploadFilesFromExerciseServiceIframe } from "@/utils/uploadFilesFromExerciseIframe"

interface PlaygroundExerciseEditorIframeProps {
  url: string
  privateSpec: unknown
  setCurrentStateReceivedFromIframe: React.Dispatch<
    React.SetStateAction<CurrentStateMessage | null>
  >
  showIframeBorders: boolean
  disableSandbox: boolean
  userInformation: UserInformation
  repositoryExercises: RepositoryExercise[]
}

const EXAMPLE_UUID = "886d57ba-4c88-4d88-9057-5e88f35ae25f"
const TITLE = "PLAYGROUND"

const PlaygroundExerciseEditorIframe: React.FC<
  React.PropsWithChildren<PlaygroundExerciseEditorIframeProps>
> = ({
  url,
  privateSpec,
  setCurrentStateReceivedFromIframe,
  showIframeBorders,
  disableSandbox,
  userInformation,
  repositoryExercises,
}) => {
  // Makes sure the iframe renders again when the data changes
  const iframeKey = url + JSON.stringify(privateSpec) + disableSandbox
  const dialog = useDialog()
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
        postThisStateToIFrame={{
          // oxlint-disable-next-line i18next/no-literal-string
          view_type: "exercise-editor",
          exercise_task_id: EXAMPLE_UUID,
          data: {
            private_spec: privateSpec,
          },
          user_information: userInformation,
          repository_exercises: repositoryExercises,
        }}
        onMessageFromIframe={async (msg, responsePort) => {
          if (!isMessageFromIframe(msg)) {
            return
          }
          if (msg.message === "current-state") {
            setCurrentStateReceivedFromIframe(msg)
          } else if (msg.message === "file-upload") {
            let response: MessageToIframe
            try {
              const files = await uploadFilesFromExerciseServiceIframe("playground", msg.files)
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
        }}
        title={TITLE}
        showBorders={showIframeBorders}
        disableSandbox={disableSandbox}
      />
    </div>
  )
}

export default withErrorBoundary(PlaygroundExerciseEditorIframe)
