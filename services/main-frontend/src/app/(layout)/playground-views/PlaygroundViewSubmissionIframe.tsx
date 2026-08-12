"use client"

import { css } from "@emotion/css"
import type { UseMutationResult, UseQueryResult } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"

import { useDialog } from "@/shared-module/common/components/dialogs/DialogProvider"
import { omitUndefined } from "@/shared-module/common/utils/nullability"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"
import MessageChannelIFrame from "@/shared-module/exercise-iframe-host/MessageChannelIFrame"
import type {
  CurrentStateMessage,
  ExerciseIframeState,
  UserInformation,
} from "@/shared-module/exercise-protocol/core/exercise-service-protocol-types"
import { isMessageFromIframe } from "@/shared-module/exercise-protocol/core/exercise-service-protocol-types.guard"
import type { ExerciseTaskGradingResult as ProtocolExerciseTaskGradingResult } from "@/shared-module/exercise-protocol/core/exerciseServiceTypes"
import type { ExerciseTaskGradingResult } from "@/utils/playgroundSchemas"

interface PlaygroundViewSubmissionIframeProps {
  url: string
  publicSpecQuery: UseQueryResult<unknown, unknown>
  // Caused weird type errors when the parameter generic was set to unknown
  // oxlint-disable-next-line typescript/no-explicit-any
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
  const dialog = useDialog()
  if (publicSpecQuery.isLoading || publicSpecQuery.isError) {
    return <>{t("error-no-public-spec")}</>
  }
  if (modelSolutionSpecQuery.isLoading || modelSolutionSpecQuery.isError) {
    return <>{t("error-no-model-solution-spec")}</>
  }
  if (gradingQuery.isPending || gradingQuery.isError) {
    return <>{t("error-no-grading")}</>
  }
  let grading: ProtocolExerciseTaskGradingResult | null = null
  if (gradingQuery.data) {
    const { set_user_variables, ...rest } = gradingQuery.data
    grading = {
      ...rest,
      ...omitUndefined({ set_user_variables }),
    }
  }
  const iframeState: ExerciseIframeState = {
    // oxlint-disable-next-line i18next/no-literal-string
    view_type: "view-submission",
    exercise_task_id: EXAMPLE_UUID,
    user_information: userInformation,
    data: {
      grading,
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
        dialog={dialog}
        key={iframeKey}
        url={url}
        postThisStateToIFrame={iframeState}
        onMessageFromIframe={(msg) => {
          if (isMessageFromIframe(msg) && msg.message === "current-state") {
            setCurrentStateReceivedFromIframe(msg)
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
