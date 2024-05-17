/* eslint-disable i18next/no-literal-string */
import React from "react"
import { useTranslation } from "react-i18next"

import { UploadResultMessage } from "../shared-module/exercise-service-protocol-types"
import { EXERCISE_SERVICE_CONTENT_ID } from "../shared-module/utils/constants"
import withErrorBoundary from "../shared-module/utils/withErrorBoundary"
import withNoSsr from "../shared-module/utils/withNoSsr"
import { ExerciseIframeState } from "../util/stateInterfaces"

import AnswerExercise from "./AnswerExercise"
import ExerciseEditor from "./ExerciseEditor"
import ViewSubmission from "./ViewSubmission"

interface Props {
  state: ExerciseIframeState | null
  setState: (updater: (state: ExerciseIframeState | null) => ExerciseIframeState | null) => void
  sendFileUploadMessage: (filename: string, file: File) => void
  fileUploadResponse: UploadResultMessage | null
}

export const StateRenderer: React.FC<React.PropsWithChildren<Props>> = ({
  state,
  setState,
  sendFileUploadMessage,
  fileUploadResponse,
}) => {
  const { t } = useTranslation()

  if (!state) {
    return <>{t("waiting-for-content")}</>
  }

  if (state.viewType === "exercise-editor") {
    return (
      <div id={EXERCISE_SERVICE_CONTENT_ID}>
        <ExerciseEditor state={state} setState={setState} />
      </div>
    )
  } else if (state.viewType === "answer-exercise") {
    return (
      <div id={EXERCISE_SERVICE_CONTENT_ID}>
        <AnswerExercise
          initialPublicSpec={state.initialPublicSpec}
          setState={setState}
          sendFileUploadMessage={sendFileUploadMessage}
          fileUploadResponse={fileUploadResponse}
        />
      </div>
    )
  } else if (state.viewType === "view-submission") {
    return (
      <div id={EXERCISE_SERVICE_CONTENT_ID}>
        <ViewSubmission state={state} />
      </div>
    )
  }

  return <>{t("waiting-for-content")}</>
}

export default withErrorBoundary(withNoSsr(StateRenderer))
