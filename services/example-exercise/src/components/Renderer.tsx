import React, { Dispatch, SetStateAction } from "react"
import { useTranslation } from "react-i18next"

import { ExerciseFeedback } from "../pages/api/grade"
import { State } from "../pages/iframe"

import AnswerExercise from "./AnswerExercise"
import ExerciseEditor from "./ExerciseEditor"
import ViewSubmission from "./ViewSubmission"

import { EXERCISE_SERVICE_CONTENT_ID } from "@/shared-module/common/utils/constants"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"
import withNoSsr from "@/shared-module/common/utils/withNoSsr"

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
    const feedbackJson: unknown | null = state.grading?.feedback_json
    const exerciseFeedback = feedbackJson ? (feedbackJson as ExerciseFeedback) : null
    return (
      <div id={EXERCISE_SERVICE_CONTENT_ID} data-view-type="view-submission">
        <ViewSubmission
          port={port}
          publicSpec={state.public_spec}
          answer={state.answer}
          gradingFeedback={exerciseFeedback}
          modelSolutionSpec={state.model_solution_spec ? state.model_solution_spec : null}
        />
      </div>
    )
  } else if (state.view_type === "exercise-editor") {
    return (
      <div id={EXERCISE_SERVICE_CONTENT_ID} data-view-type="exercise-editor">
        <ExerciseEditor state={state.private_spec} port={port} setState={setState} />
      </div>
    )
  } else {
    return <>{t("waiting-for-content")}</>
  }
}

export default withErrorBoundary(withNoSsr(Renderer))
