/* eslint-disable i18next/no-literal-string */
import React from "react"
import { useTranslation } from "react-i18next"

import withErrorBoundary from "../shared-module/utils/withErrorBoundary"
import withNoSsr from "../shared-module/utils/withNoSsr"
import { IframeState } from "../util/stateInterfaces"

import AnswerExercise from "./AnswerExercise"
import ExerciseEditor from "./ExerciseEditor"
import ViewSubmission from "./ViewSubmission"

interface Props {
  state: IframeState | null
  setState: (updater: (state: IframeState | null) => IframeState | null) => void
}

export const StateRenderer: React.FC<React.PropsWithChildren<Props>> = ({ state, setState }) => {
  const { t } = useTranslation()

  if (!state) {
    return <>{t("waiting-for-content")}</>
  }

  if (state.viewType === "exercise-editor") {
    return <ExerciseEditor state={state} setState={setState} />
  } else if (state.viewType === "answer-exercise") {
    return <AnswerExercise initialPublicSpec={state.initialPublicSpec} setState={setState} />
  } else if (state.viewType === "view-submission") {
    return <ViewSubmission state={state} />
  }

  return <>{t("waiting-for-content")}</>
}

export default withErrorBoundary(withNoSsr(StateRenderer))
