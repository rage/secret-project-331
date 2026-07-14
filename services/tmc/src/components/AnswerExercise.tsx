import _ from "lodash"
import React from "react"

import AnswerBrowserExercise from "./AnswerBrowserExercise"
import AnswerEditorExercise from "./AnswerEditorExercise"

import type { UploadResultMessage } from "@/shared-module/exercise-protocol/core/exercise-service-protocol-types"
import type { RunResult } from "@/tmc/cli"
import type { ExerciseTaskGradingResult } from "@/util/exerciseServiceApi"
import type { ExerciseIframeState, PublicSpec, UserAnswer } from "@/util/stateInterfaces"

interface Props {
  publicSpec: PublicSpec
  userAnswer: UserAnswer
  setState: (updater: (state: ExerciseIframeState | null) => ExerciseIframeState | null) => void
  testRequestResponse: RunResult | null
  sendFileUploadMessage: (filename: string, file: File) => void
  fileUploadResponse: UploadResultMessage | null
  grading?: ExerciseTaskGradingResult | null
}

const AnswerExercise: React.FC<React.PropsWithChildren<Props>> = ({
  publicSpec,
  userAnswer,
  setState,
  testRequestResponse,
  sendFileUploadMessage,
  fileUploadResponse,
  grading,
}) => {
  // student exercise view
  if (userAnswer.type === "browser") {
    return (
      <AnswerBrowserExercise
        publicSpec={publicSpec}
        initialState={userAnswer.files}
        testRequestResponse={testRequestResponse}
        setState={setState}
        grading={grading}
        readOnly={grading !== null && grading !== undefined}
      />
    )
  } else if (userAnswer.type === "editor") {
    return (
      <AnswerEditorExercise
        publicSpec={publicSpec}
        sendFileUploadMessage={sendFileUploadMessage}
        fileUploadResponse={fileUploadResponse}
      />
    )
  }
  throw new Error("Unhandled exercise type")
}

export default AnswerExercise
