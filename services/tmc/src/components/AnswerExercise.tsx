import React from "react"

import type { UploadResultMessage } from "@/shared-module/exercise-protocol/core/exercise-service-protocol-types"
import type { RunResult } from "@/tmc/cli"
import type { ExerciseTaskGradingResult } from "@/util/exerciseServiceApi"
import type { ExerciseFile, PublicSpec } from "@/util/stateInterfaces"

import AnswerBrowserExercise from "./AnswerBrowserExercise"
import AnswerEditorExercise from "./AnswerEditorExercise"

interface Props {
  publicSpec: PublicSpec
  /** The browser editor's files; ignored by an editor-mode exercise. */
  files: ExerciseFile[]
  /** Called with the edited files; omit to keep the editor read-only. */
  onFilesChange?: ((files: ExerciseFile[]) => void) | undefined
  testRequestResponse: RunResult | null
  sendFileUploadMessage: (file: File) => void
  fileUploadResponse: UploadResultMessage | null
  grading?: ExerciseTaskGradingResult | null
}

const AnswerExercise: React.FC<React.PropsWithChildren<Props>> = ({
  publicSpec,
  files,
  onFilesChange,
  testRequestResponse,
  sendFileUploadMessage,
  fileUploadResponse,
  grading,
}) => {
  if (publicSpec.type === "browser") {
    return (
      <AnswerBrowserExercise
        publicSpec={publicSpec}
        initialState={files}
        testRequestResponse={testRequestResponse}
        onFilesChange={onFilesChange}
        grading={grading}
        readOnly={onFilesChange === undefined || (grading !== null && grading !== undefined)}
      />
    )
  }
  return (
    <AnswerEditorExercise
      publicSpec={publicSpec}
      sendFileUploadMessage={sendFileUploadMessage}
      fileUploadResponse={fileUploadResponse}
    />
  )
}

export default AnswerExercise
