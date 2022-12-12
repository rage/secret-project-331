import { css } from "@emotion/css"
import { useState } from "react"

import { RepositoryExercise } from "../../../shared-module/bindings"
import MessageChannelIFrame from "../../../shared-module/components/MessageChannelIFrame"
import {
  CurrentStateMessage,
  UserInformation,
} from "../../../shared-module/exercise-service-protocol-types"
import { isMessageFromIframe } from "../../../shared-module/exercise-service-protocol-types.guard"
import { onUploadFileMessage } from "../../../shared-module/utils/exerciseServices"

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
  const [files, setFiles] = useState<Map<string, string | Blob>>(new Map())
  // Makes sure the iframe renders again when the data changes
  const iframeKey = url + JSON.stringify(privateSpec) + disableSandbox
  return (
    <div
      className={css`
        margin-top: 1rem;
      `}
    >
      <MessageChannelIFrame
        key={iframeKey}
        url={url}
        postThisStateToIFrame={{
          // eslint-disable-next-line i18next/no-literal-string
          view_type: "exercise-editor",
          exercise_task_id: EXAMPLE_UUID,
          data: {
            private_spec: privateSpec,
          },
          user_information: userInformation,
          repository_exercises: repositoryExercises,
        }}
        onMessageFromIframe={async (msg, responsePort) => {
          if (isMessageFromIframe(msg)) {
            if (msg.message === "current-state") {
              setCurrentStateReceivedFromIframe(msg)
            } else if (msg.message === "set-file-uploads") {
              // eslint-disable-next-line i18next/no-literal-string
              setFiles(msg.files)
            } else if (msg.message === "upload-files") {
              // eslint-disable-next-line i18next/no-literal-string
              await onUploadFileMessage("playground", files, responsePort)
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

export default PlaygroundExerciseEditorIframe
