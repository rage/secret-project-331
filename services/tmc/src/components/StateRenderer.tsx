import React from "react"
import { useTranslation } from "react-i18next"

import { EXERCISE_SERVICE_CONTENT_ID } from "@/shared-module/exercise-protocol/core/constants"
import type { UploadResultMessage } from "@/shared-module/exercise-protocol/core/exercise-service-protocol-types"
import withErrorBoundary from "@/shared-module/exercise-react/react/components/withErrorBoundary"
import withNoSsr from "@/shared-module/exercise-react/react/components/withNoSsr"
import type { RunResult } from "@/tmc/cli"
import type { ExerciseFile, ExerciseIframeState } from "@/util/stateInterfaces"

import AnswerExercise from "./AnswerExercise"
import ExerciseEditor from "./ExerciseEditor"
import ViewSubmission from "./ViewSubmission"

interface Props {
  state: ExerciseIframeState | null
  setState: (updater: (state: ExerciseIframeState | null) => ExerciseIframeState | null) => void
  setAnswerFiles: (files: ExerciseFile[]) => void
  testRequestResponse: RunResult | null
  sendFileUploadMessage: (file: File) => void
  requestRepositoryExercises: () => void
  fileUploadResponse: UploadResultMessage | null
}

export const StateRenderer: React.FC<React.PropsWithChildren<Props>> = ({
  state,
  setState,
  setAnswerFiles,
  testRequestResponse,
  requestRepositoryExercises,
  sendFileUploadMessage,
  fileUploadResponse,
}) => {
  const { t } = useTranslation()

  if (!state) {
    return <>{t("waiting-for-content")}</>
  }

  if (state.view_type === "exercise-editor") {
    return (
      <div id={EXERCISE_SERVICE_CONTENT_ID}>
        <ExerciseEditor
          state={state}
          setState={setState}
          requestRepositoryExercises={requestRepositoryExercises}
        />
      </div>
    )
  } else if (state.view_type === "answer-exercise") {
    return (
      <div id={EXERCISE_SERVICE_CONTENT_ID}>
        <AnswerExercise
          publicSpec={state.public_spec}
          files={state.editor_files}
          onFilesChange={setAnswerFiles}
          testRequestResponse={testRequestResponse}
          sendFileUploadMessage={sendFileUploadMessage}
          fileUploadResponse={fileUploadResponse}
        />
      </div>
    )
  } else if (state.view_type === "view-submission") {
    if (state.public_spec.type === "browser" && state.submitted_files.length > 0) {
      return (
        <div id={EXERCISE_SERVICE_CONTENT_ID}>
          <AnswerExercise
            publicSpec={state.public_spec}
            files={state.submitted_files}
            testRequestResponse={null}
            sendFileUploadMessage={sendFileUploadMessage}
            fileUploadResponse={fileUploadResponse}
            grading={state.grading}
          />
        </div>
      )
    }
    // An editor-mode answer, or one whose archive could not be read.
    return (
      <div id={EXERCISE_SERVICE_CONTENT_ID}>
        <ViewSubmission state={state} />
      </div>
    )
  }

  return <>{t("waiting-for-content")}</>
}

export default withErrorBoundary(withNoSsr(StateRenderer))
