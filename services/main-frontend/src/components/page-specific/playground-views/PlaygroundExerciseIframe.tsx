import { css } from "@emotion/css"
import { UseQueryResult } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"

import MessageChannelIFrame from "../../../shared-module/components/MessageChannelIFrame"
import { CurrentStateMessage } from "../../../shared-module/exercise-service-protocol-types"

interface PlaygroundExerciseIframeProps {
  url: string
  publicSpecQuery: UseQueryResult<unknown>
  setCurrentStateReceivedFromIframe: React.Dispatch<
    React.SetStateAction<CurrentStateMessage | null>
  >
  showIframeBorders: boolean
}

const EXAMPLE_UUID = "886d57ba-4c88-4d88-9057-5e88f35ae25f"
const TITLE = "PLAYGROUND"

const PlaygroundExerciseIframe: React.FC<PlaygroundExerciseIframeProps> = ({
  url,
  publicSpecQuery,
  setCurrentStateReceivedFromIframe,
  showIframeBorders,
}) => {
  const { t } = useTranslation()
  if (publicSpecQuery.isLoading || publicSpecQuery.isError || publicSpecQuery.isIdle) {
    return <>{t("error-no-public-spec")}</>
  }
  // Makes sure the iframe renders again when the data changes
  const iframeKey = url + JSON.stringify(publicSpecQuery.data)
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
          view_type: "exercise",
          exercise_task_id: EXAMPLE_UUID,
          data: {
            public_spec: publicSpecQuery.data,
            // Not supported in the playground yet. Would prefill the exercise with the user's previous answer.
            previous_submission: null,
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

export default PlaygroundExerciseIframe
