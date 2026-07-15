import type { Dispatch, SetStateAction } from "react"
import React from "react"
import { useTranslation } from "react-i18next"

import AnswerExercise from "./AnswerExercise"
import ExerciseEditor from "./ExerciseEditor"
import type { State } from "./IframeView"
import ViewSubmission from "./ViewSubmission"

import withErrorBoundary from "@/lib/withErrorBoundary"
import { EXERCISE_SERVICE_CONTENT_ID } from "@/shared-module/exercise-protocol/core/constants"
import withNoSsr from "@/shared-module/exercise-react/react/components/withNoSsr"

interface RendererProps {
  state: State | null
  setState: Dispatch<SetStateAction<State | null>>
  port: MessagePort | null
}

const Renderer: React.FC<React.PropsWithChildren<RendererProps>> = ({ state, setState, port }) => {
  const { t } = useTranslation()

  if (!port) {
    return <>{t("waiting-for-port")}</>
  }

  if (!state) {
    return <>{t("waiting-for-content")}</>
  }

  if (state.view_type === "answer-exercise") {
    return (
      <div id={EXERCISE_SERVICE_CONTENT_ID} data-view-type="answer-exercise">
        <AnswerExercise port={port} state={state.public_spec} />
      </div>
    )
  } else if (state.view_type === "view-submission") {
    return (
      <div id={EXERCISE_SERVICE_CONTENT_ID} data-view-type="view-submission">
        <ViewSubmission
          port={port}
          publicSpec={state.public_spec}
          answer={state.answer}
          gradingFeedback={state.feedback_json}
          modelSolutionSpec={state.model_solution_spec}
        />
      </div>
    )
  } else if (state.view_type === "exercise-editor") {
    return (
      <div id={EXERCISE_SERVICE_CONTENT_ID} data-view-type="exercise-editor">
        <ExerciseEditor state={state.private_spec} port={port} setState={setState} />
      </div>
    )
  }
  return <>{t("waiting-for-content")}</>
}

export default withErrorBoundary(withNoSsr(Renderer))
