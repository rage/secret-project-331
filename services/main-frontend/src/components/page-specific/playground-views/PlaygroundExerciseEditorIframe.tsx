import { css } from "@emotion/css"
import axios from "axios"

import MessageChannelIFrame from "../../../shared-module/components/MessageChannelIFrame"
import {
  CurrentStateMessage,
  UserInformation,
} from "../../../shared-module/exercise-service-protocol-types"
import { isMessageFromIframe } from "../../../shared-module/exercise-service-protocol-types.guard"

interface PlaygroundExerciseEditorIframeProps {
  url: string
  privateSpec: unknown
  setCurrentStateReceivedFromIframe: React.Dispatch<
    React.SetStateAction<CurrentStateMessage | null>
  >
  showIframeBorders: boolean
  disableSandbox: boolean
  userInformation: UserInformation
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
}) => {
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
        }}
        onMessageFromIframe={async (msg) => {
          if (isMessageFromIframe(msg)) {
            if (msg.message === "current-state") {
              setCurrentStateReceivedFromIframe(msg)
            } else if (msg.message === "file-upload") {
              // upload data to playground-specific endpoint
              await axios.post(
                `http://project-331.local/api/v0/files/playground/${msg.url}`,
                msg.data,
              )
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
