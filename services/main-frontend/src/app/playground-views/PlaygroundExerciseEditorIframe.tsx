"use client"

import { css } from "@emotion/css"

import { useDialog } from "@/shared-module/common/components/dialogs/DialogProvider"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"
import MessageChannelIFrame from "@/shared-module/exercise-iframe-host/MessageChannelIFrame"
import {
  CurrentStateMessage,
  UserInformation,
} from "@/shared-module/exercise-protocol/core/exercise-service-protocol-types"
import { isMessageFromIframe } from "@/shared-module/exercise-protocol/core/exercise-service-protocol-types.guard"
import { RepositoryExercise } from "@/utils/playgroundSchemas"

interface PlaygroundExerciseEditorIframeProps {
  url: string
  privateSpec: unknown
  setCurrentStateReceivedFromIframe: React.Dispatch<
    React.SetStateAction<CurrentStateMessage | null>
  >
  showIframeBorders: boolean
  disableSandbox: boolean
  userInformation: UserInformation
  repositoryExercises: Array<RepositoryExercise>
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
        onMessageFromIframe={async (msg, _responsePort) => {
          if (isMessageFromIframe(msg)) {
            if (msg.message === "current-state") {
              setCurrentStateReceivedFromIframe(msg)
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

export default withErrorBoundary(PlaygroundExerciseEditorIframe)
