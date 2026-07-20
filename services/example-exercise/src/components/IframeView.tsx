import React, { useState } from "react"
import ReactDOM from "react-dom"
import { useTranslation } from "react-i18next"

import Renderer from "@/components/Renderer"
import { forgivingIsSetStateMessage } from "@/shared-module/exercise-protocol/core/exercise-service-protocol-types"
import { isSetLanguageMessage } from "@/shared-module/exercise-protocol/core/exercise-service-protocol-types.guard"
import HeightTrackingContainer from "@/shared-module/exercise-react/react/components/HeightTrackingContainer"
import useExerciseServiceParentConnection from "@/shared-module/exercise-react/react/hooks/useExerciseServiceParentConnection"
import type { ExerciseTaskGradingResult } from "@/util/exerciseServiceApi"
import type {
  Alternative,
  Answer,
  ExerciseFeedback,
  ModelSolutionApi,
  PublicAlternative,
} from "@/util/stateInterfaces"
import {
  isExerciseFeedback,
  parseAnswer,
  parseModelSolution,
  parsePrivateSpec,
  parsePublicSpec,
} from "@/util/stateInterfaces"

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

/**
 * The exercise UI inside the sandboxed iframe. A plain component (the route wraps it in the error
 * boundary) so unit tests can render it directly.
 */
const IframeView: React.FC = () => {
  const { i18n } = useTranslation()
  const [state, setState] = useState<State | null>(null)

  const port = useExerciseServiceParentConnection((messageData) => {
    if (forgivingIsSetStateMessage(messageData)) {
      ReactDOM.flushSync(() => {
        if (messageData.view_type === "answer-exercise") {
          setState({
            view_type: messageData.view_type,
            public_spec: parsePublicSpec(messageData.data.public_spec),
          })
        } else if (messageData.view_type === "exercise-editor") {
          setState({
            view_type: messageData.view_type,
            private_spec: parsePrivateSpec(messageData.data.private_spec),
          })
        } else if (messageData.view_type === "view-submission") {
          const feedbackJson = messageData.data.grading?.feedback_json
          setState({
            view_type: messageData.view_type,
            public_spec: parsePublicSpec(messageData.data.public_spec),
            answer: parseAnswer(messageData.data.user_answer),
            feedback_json: isExerciseFeedback(feedbackJson) ? feedbackJson : null,
            model_solution_spec: parseModelSolution(messageData.data.model_solution_spec),
            grading: messageData.data.grading,
          })
        } else {
          console.error("Unknown view type received from parent")
        }
      })
    } else if (isSetLanguageMessage(messageData)) {
      i18n.changeLanguage(messageData.data)
    } else {
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

export default IframeView
