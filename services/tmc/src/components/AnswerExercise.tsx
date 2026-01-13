"use client"
import _ from "lodash"
import React from "react"

import AnswerBrowserExercise from "./AnswerBrowserExercise"
import AnswerEditorExercise from "./AnswerEditorExercise"

import { UploadResultMessage } from "@/shared-module/common/exercise-service-protocol-types"
import { RunResult } from "@/tmc/cli"
import { ExerciseIframeState, PublicSpec, UserAnswer } from "@/util/stateInterfaces"

interface Props {
  publicSpec: PublicSpec
  userAnswer: UserAnswer
  setState: (updater: (state: ExerciseIframeState | null) => ExerciseIframeState | null) => void
  testRequestResponse: RunResult | null
  sendFileUploadMessage: (filename: string, file: File) => void
  fileUploadResponse: UploadResultMessage | null
}

const AnswerExercise: React.FC<React.PropsWithChildren<Props>> = ({
  publicSpec,
  userAnswer,
  setState,
  testRequestResponse,
  sendFileUploadMessage,
  fileUploadResponse,
}) => {
  // student exercise view
  if (userAnswer.type === "browser") {
    return (
      <AnswerBrowserExercise
        publicSpec={publicSpec}
        initialState={userAnswer.files}
        testRequestResponse={testRequestResponse}
        setState={setState}
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
  } else {
    throw new Error("Unhandled exercise type")
  }
}

export default AnswerExercise
