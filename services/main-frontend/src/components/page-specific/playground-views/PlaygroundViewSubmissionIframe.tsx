import { css } from "@emotion/css"
import { UseMutationResult, UseQueryResult } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"

import { ExerciseTaskGradingResult } from "@/shared-module/common/bindings"
import MessageChannelIFrame from "@/shared-module/common/components/MessageChannelIFrame"
import {
  CurrentStateMessage,
  ExerciseIframeState,
  UserInformation,
} from "@/shared-module/common/exercise-service-protocol-types"
import { isMessageFromIframe } from "@/shared-module/common/exercise-service-protocol-types.guard"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"

interface PlaygroundViewSubmissionIframeProps {
  url: string
  publicSpecQuery: UseQueryResult<unknown, unknown>
  // Caused weird type errors when the parameter generic was set to unknown
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  gradingQuery: UseMutationResult<ExerciseTaskGradingResult, unknown, any, unknown>
  modelSolutionSpecQuery: UseQueryResult<unknown, unknown>
  userAnswer: unknown
  setCurrentStateReceivedFromIframe: React.Dispatch<
    React.SetStateAction<CurrentStateMessage | null>
  >
  showIframeBorders: boolean
  sendModelsolutionSpec: boolean
  disableSandbox: boolean
  userInformation: UserInformation
}

const EXAMPLE_UUID = "886d57ba-4c88-4d88-9057-5e88f35ae25f"
const TITLE = "PLAYGROUND"

const PlaygroundViewSubmissionIframe: React.FC<
  React.PropsWithChildren<PlaygroundViewSubmissionIframeProps>
> = ({
  url,
  publicSpecQuery,
  gradingQuery,
  modelSolutionSpecQuery,
  setCurrentStateReceivedFromIframe,
  showIframeBorders,
  userAnswer,
  sendModelsolutionSpec,
  disableSandbox,
  userInformation,
}) => {
  const { t } = useTranslation()
  if (publicSpecQuery.isPending || publicSpecQuery.isError) {
    return <>{t("error-no-public-spec")}</>
  }
  if (modelSolutionSpecQuery.isPending || modelSolutionSpecQuery.isError) {
    return <>{t("error-no-model-solution-spec")}</>
  }
  if (gradingQuery.isPending || gradingQuery.isError) {
    return <>{t("error-no-grading")}</>
  }
  const iframeState: ExerciseIframeState = {
    // eslint-disable-next-line i18next/no-literal-string
    view_type: "view-submission",
    exercise_task_id: EXAMPLE_UUID,
    user_information: userInformation,
    data: {
      grading: gradingQuery.data ?? null,
      user_answer: userAnswer,
      public_spec: publicSpecQuery.data,
      model_solution_spec: sendModelsolutionSpec ? modelSolutionSpecQuery.data : null,
    },
  }
  // Makes sure the iframe renders again when the data changes
  const iframeKey = url + JSON.stringify(iframeState) + disableSandbox
  return (
    <div
      className={css`
        margin-top: 1rem;
      `}
    >
      <MessageChannelIFrame
        key={iframeKey}
        url={url}
        postThisStateToIFrame={iframeState}
        onMessageFromIframe={async (msg) => {
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

export default withErrorBoundary(PlaygroundViewSubmissionIframe)
