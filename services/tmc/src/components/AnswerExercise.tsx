/* eslint-disable i18next/no-literal-string */
import _ from "lodash"
import React from "react"

import { IframeState, PublicSpec } from "../util/stateInterfaces"

import AnswerBrowserExercise from "./AnswerBrowserExercise"
import AnswerEditorExercise from "./AnswerEditorExercise"

interface Props {
  initialPublicSpec: PublicSpec
  setState: (updater: (state: IframeState | null) => IframeState | null) => void
  sendFileUploadMessage: (files: Map<string, string | Blob>) => void
}

const AnswerExercise: React.FC<React.PropsWithChildren<Props>> = ({
  initialPublicSpec,
  setState,
  sendFileUploadMessage,
}) => {
  // student exercise view
  if (initialPublicSpec.type === "browser") {
    return <AnswerBrowserExercise initialPublicSpec={initialPublicSpec} setState={setState} />
  } else if (initialPublicSpec.type === "editor") {
    return (
      <AnswerEditorExercise
        initialPublicSpec={initialPublicSpec}
        sendFileUploadMessage={sendFileUploadMessage}
      />
    )
  } else {
    // eslint-disable-next-line i18next/no-literal-string
    throw "Unhandled exercise type"
  }
}

export default AnswerExercise
