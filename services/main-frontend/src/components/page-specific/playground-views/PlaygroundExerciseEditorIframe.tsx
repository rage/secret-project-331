import { css } from "@emotion/css"

import MessageChannelIFrame from "../../../shared-module/components/MessageChannelIFrame"
import { CurrentStateMessage } from "../../../shared-module/exercise-service-protocol-types"

interface PlaygroundExerciseEditorIframeProps {
  url: string
  privateSpec: unknown
  setCurrentStateReceivedFromIframe: React.Dispatch<
    React.SetStateAction<CurrentStateMessage | null>
  >
  showIframeBorders: boolean
}

const EXAMPLE_UUID = "886d57ba-4c88-4d88-9057-5e88f35ae25f"
const TITLE = "PLAYGROUND"

const PlaygroundExerciseEditorIframe: React.FC<PlaygroundExerciseEditorIframeProps> = ({
  url,
  privateSpec,
  setCurrentStateReceivedFromIframe,
  showIframeBorders,
}) => {
  // Makes sure the iframe renders again when the data changes
  const iframeKey = url + JSON.stringify(privateSpec)
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
        }}
        onMessageFromIframe={(msg) => {
          setCurrentStateReceivedFromIframe(msg)
        }}
        title={TITLE}
        showBorders={showIframeBorders}
      />
    </div>
  )
}

export default PlaygroundExerciseEditorIframe
