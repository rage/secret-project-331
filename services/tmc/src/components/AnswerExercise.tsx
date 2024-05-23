/* eslint-disable i18next/no-literal-string */
import _ from "lodash"
import React from "react"

import { ExerciseIframeState, PublicSpec } from "../util/stateInterfaces"

import AnswerBrowserExercise from "./AnswerBrowserExercise"
import AnswerEditorExercise from "./AnswerEditorExercise"

import { UploadResultMessage } from "@/shared-module/common/exercise-service-protocol-types"

interface Props {
  initialPublicSpec: PublicSpec
  setState: (updater: (state: ExerciseIframeState | null) => ExerciseIframeState | null) => void
  sendFileUploadMessage: (filename: string, file: File) => void
  fileUploadResponse: UploadResultMessage | null
}

const AnswerExercise: React.FC<React.PropsWithChildren<Props>> = ({
  initialPublicSpec,
  setState,
  sendFileUploadMessage,
  fileUploadResponse,
}) => {
  // student exercise view
  if (initialPublicSpec.type === "browser") {
    return <AnswerBrowserExercise initialPublicSpec={initialPublicSpec} setState={setState} />
  } else if (initialPublicSpec.type === "editor") {
    return (
      <AnswerEditorExercise
        initialPublicSpec={initialPublicSpec}
        sendFileUploadMessage={sendFileUploadMessage}
        fileUploadResponse={fileUploadResponse}
      />
    )
  } else {
    // eslint-disable-next-line i18next/no-literal-string
    throw new Error("Unhandled exercise type")
  }
}

export default AnswerExercise
