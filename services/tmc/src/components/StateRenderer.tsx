/* eslint-disable i18next/no-literal-string */
import React, { Dispatch, SetStateAction } from "react"
import { useTranslation } from "react-i18next"

import { EXERCISE_SERVICE_CONTENT_ID } from "../shared-module/utils/constants"
import withErrorBoundary from "../shared-module/utils/withErrorBoundary"
import withNoSsr from "../shared-module/utils/withNoSsr"
import { IframeState } from "../util/stateInterfaces"

import AnswerExercise from "./AnswerExercise"
import ExerciseEditor from "./ExerciseEditor"
import ViewSubmission from "./ViewSubmission"

interface Props {
  state: IframeState | null
  setState: Dispatch<SetStateAction<IframeState | null>>
  port: MessagePort | null
}

export const StateRenderer: React.FC<React.PropsWithChildren<Props>> = ({
  state,
  setState,
  port,
}) => {
  const { t } = useTranslation()

  if (!port) {
    return <>{t("waiting-for-port")}</>
  }

  if (!state) {
    return <>{t("waiting-for-content")}</>
  }

  if (state.viewType === "exercise-editor") {
    return (
      <div id={EXERCISE_SERVICE_CONTENT_ID}>
        <ExerciseEditor state={state} setState={setState} port={port} />
      </div>
    )
  } else if (state.viewType === "answer-exercise") {
    return (
      <div id={EXERCISE_SERVICE_CONTENT_ID}>
        <AnswerExercise
          port={port}
          publicSpec={state.publicSpec}
          initialPublicSpec={state.initialPublicSpec}
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
