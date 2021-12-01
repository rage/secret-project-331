import React, { Dispatch, SetStateAction } from "react"
import { useTranslation } from "react-i18next"
import { useDispatch } from "react-redux"

import { ModelSolutionQuiz, PublicQuiz, Quiz } from "../../types/types"
import { SubmissionData } from "../pages/iframe"
import { ViewType } from "../shared-module/iframe-protocol-types"
import { initializedEditor } from "../store/editor/editorActions"
import { normalizeData } from "../util/normalizerFunctions"

import Editor from "./Editor"
import PlaygroundExercise from "./PlaygroundExercise"
import Submission from "./Submission"
import Widget from "./widget"

interface RendererProps {
  viewType: ViewType
  state: SubmissionData | Quiz | PublicQuiz
  setState: Dispatch<SetStateAction<SubmissionData | PublicQuiz | Quiz | null>>
  port: MessagePort
  maxWidth: number
}

export const Renderer: React.FC<RendererProps> = ({ viewType, state, port, maxWidth }) => {
  const { t } = useTranslation()
  const dispatch = useDispatch()

  if (viewType === "exercise") {
    return <Widget maxWidth={maxWidth} port={port} quiz={state as PublicQuiz} />
  } else if (viewType === "view-submission") {
    return (
      <Submission
        port={port}
        maxWidth={maxWidth}
        publicAlternatives={(state as SubmissionData).public_spec as PublicQuiz}
        modelSolutions={
          (state as SubmissionData).submission_result.model_solution_spec as ModelSolutionQuiz
        }
        user_answer={(state as SubmissionData).user_answer}
      />
    )
  } else if (viewType === "exercise-editor") {
    dispatch(initializedEditor(normalizeData(state as Quiz), state as Quiz))
    return <Editor port={port} />
  } else if (viewType === "playground-exercise") {
    return <PlaygroundExercise port={port} maxWidth={maxWidth} quiz={state as PublicQuiz} />
  } else {
    return <>{t("waiting-for-content")}</>
  }
}
