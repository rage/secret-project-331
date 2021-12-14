import React, { Dispatch, SetStateAction } from "react"
import { useTranslation } from "react-i18next"
import { useDispatch } from "react-redux"

import { State } from "../pages/iframe"
import { initializedEditor } from "../store/editor/editorActions"
import { normalizeData } from "../util/normalizerFunctions"

import Editor from "./Editor"
import Exercise from "./Exercise"
import Submission from "./Submission"

interface RendererProps {
  state: State
  setState: Dispatch<SetStateAction<State | null>>
  port: MessagePort
  maxWidth: number
}

export const Renderer: React.FC<RendererProps> = ({ state, port, maxWidth }) => {
  const { t } = useTranslation()
  const dispatch = useDispatch()

  if (state.viewType === "exercise") {
    return <Exercise port={port} maxWidth={maxWidth} quiz={state.publicSpec} />
  } else if (state.viewType === "view-submission") {
    return (
      <Submission
        port={port}
        maxWidth={maxWidth}
        publicAlternatives={state.publicSpec}
        modelSolutions={state.modelSolutions}
        user_answer={state.userAnswer}
        feedback_json={state.feedbackJson}
      />
    )
  } else if (state.viewType === "exercise-editor") {
    dispatch(initializedEditor(normalizeData(state.privateSpec), state.privateSpec))
    return <Editor port={port} />
  } else {
    return <>{t("waiting-for-content")}</>
  }
}
