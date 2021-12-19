import React, { Dispatch, SetStateAction } from "react"
import { useTranslation } from "react-i18next"

import { ExerciseFeedback } from "../pages/api/grade"
import { State } from "../pages/iframe"

import Editor from "./Editor"
import Exercise from "./Exercise"
import Submission from "./Submission"

interface RendererProps {
  state: State
  setState: Dispatch<SetStateAction<State | null>>
  port: MessagePort
  maxWidth: number
}

export const Renderer: React.FC<RendererProps> = ({ state, setState, port, maxWidth }) => {
  const { t } = useTranslation()

  if (state.view_type === "exercise") {
    return <Exercise maxWidth={maxWidth} port={port} state={state.public_spec} />
  } else if (state.view_type === "view-submission") {
    const feedbackJson: unknown | null = state.grading?.feedback_json
    const exerciseFeedback = feedbackJson ? (feedbackJson as ExerciseFeedback) : null
    return (
      <Submission
        port={port}
        maxWidth={maxWidth}
        publicAlternatives={state.public_spec}
        selectedId={state.selectedOptionId}
        selectedOptionIsCorrect={exerciseFeedback?.selectedOptionIsCorrect || null}
        modelSolutions={state.model_solution_spec ? state.model_solution_spec : null}
      />
    )
  } else if (state.view_type === "exercise-editor") {
    return <Editor state={state.private_spec} maxWidth={maxWidth} port={port} setState={setState} />
  } else {
    return <>{t("waiting-for-content")}</>
  }
}
