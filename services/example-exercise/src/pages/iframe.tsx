import React, { useState } from "react"
import ReactDOM from "react-dom"
import { useTranslation } from "react-i18next"

import Renderer from "../components/Renderer"
import { Alternative, Answer, ModelSolutionApi, PublicAlternative } from "../util/stateInterfaces"

import { ExerciseFeedback } from "./api/grade"

import { ExerciseTaskGradingResult } from "@/shared-module/common/bindings"
import HeightTrackingContainer from "@/shared-module/common/components/HeightTrackingContainer"
import { forgivingIsSetStateMessage } from "@/shared-module/common/exercise-service-protocol-types"
import { isSetLanguageMessage } from "@/shared-module/common/exercise-service-protocol-types.guard"
import useExerciseServiceParentConnection from "@/shared-module/common/hooks/useExerciseServiceParentConnection"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"

export interface SubmissionData {
  grading: ExerciseTaskGradingResult
  user_answer: Answer
  public_spec: PublicAlternative[]
}

export type State =
  | {
      view_type: "answer-exercise"
      public_spec: PublicAlternative[]
    }
  | {
      view_type: "view-submission"
      public_spec: PublicAlternative[]
      answer: Answer
      feedback_json: ExerciseFeedback | null
      model_solution_spec: ModelSolutionApi | null
      grading: ExerciseTaskGradingResult | null
    }
  | {
      view_type: "exercise-editor"
      private_spec: Alternative[]
    }

const Iframe: React.FC<React.PropsWithChildren<unknown>> = () => {
  const { i18n } = useTranslation()
  const [state, setState] = useState<State | null>(null)

  const port = useExerciseServiceParentConnection((messageData) => {
    if (forgivingIsSetStateMessage(messageData)) {
      ReactDOM.flushSync(() => {
        if (messageData.view_type === "answer-exercise") {
          setState({
            view_type: messageData.view_type,
            public_spec: messageData.data.public_spec as PublicAlternative[],
          })
        } else if (messageData.view_type === "exercise-editor") {
          setState({
            view_type: messageData.view_type,
            private_spec: (messageData.data.private_spec as Alternative[]) || [],
          })
        } else if (messageData.view_type === "view-submission") {
          const userAnswer = messageData.data.user_answer as Answer
          setState({
            view_type: messageData.view_type,
            public_spec: messageData.data.public_spec as PublicAlternative[],
            answer: userAnswer,
            feedback_json: messageData.data.grading?.feedback_json as ExerciseFeedback | null,
            model_solution_spec: messageData.data.model_solution_spec as ModelSolutionApi | null,
            grading: messageData.data.grading,
          })
        } else {
          // eslint-disable-next-line i18next/no-literal-string
          console.error("Unknown view type received from parent")
        }
      })
    } else if (isSetLanguageMessage(messageData)) {
      i18n.changeLanguage(messageData.data)
    } else {
      // eslint-disable-next-line i18next/no-literal-string
      console.error("Frame received an unknown message from message port")
    }
  })

  return (
    <HeightTrackingContainer port={port}>
      <div>
        <Renderer port={port} setState={setState} state={state} />
      </div>
    </HeightTrackingContainer>
  )
}

export default withErrorBoundary(Iframe)
