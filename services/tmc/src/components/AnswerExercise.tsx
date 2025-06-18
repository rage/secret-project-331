import _ from "lodash"
import React from "react"

import { ExerciseIframeState, PublicSpec } from "../util/stateInterfaces"

import AnswerBrowserExercise from "./AnswerBrowserExercise"
import AnswerEditorExercise from "./AnswerEditorExercise"

import { UploadResultMessage } from "@/shared-module/common/exercise-service-protocol-types"
import { ExerciseFile, RunResult } from "@/tmc/cli"

interface Props {
  initialPublicSpec: PublicSpec
  setState: (updater: (state: ExerciseIframeState | null) => ExerciseIframeState | null) => void
  sendTestRequestMessage: (archiveDownloadUrl: string, editorFiles: Array<ExerciseFile>) => void
  testRequestResponse: RunResult | null
  resetTestRequestResponse: () => void
  sendFileUploadMessage: (filename: string, file: File) => void
  fileUploadResponse: UploadResultMessage | null
}

const AnswerExercise: React.FC<React.PropsWithChildren<Props>> = ({
  initialPublicSpec,
  setState,
  sendTestRequestMessage,
  testRequestResponse,
  resetTestRequestResponse,
  sendFileUploadMessage,
  fileUploadResponse,
}) => {
  // student exercise view
  if (initialPublicSpec.type === "browser") {
    return (
      <AnswerBrowserExercise
        initialPublicSpec={initialPublicSpec}
        sendTestRequestMessage={sendTestRequestMessage}
        testRequestResponse={testRequestResponse}
        resetTestRequestResponse={resetTestRequestResponse}
        setState={setState}
      />
    )
  } else if (initialPublicSpec.type === "editor") {
    return (
      <AnswerEditorExercise
        initialPublicSpec={initialPublicSpec}
        sendFileUploadMessage={sendFileUploadMessage}
        fileUploadResponse={fileUploadResponse}
      />
    )
  } else {
    throw new Error("Unhandled exercise type")
  }
}

export default AnswerExercise
