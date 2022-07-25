import { css } from "@emotion/css"
import { useRouter } from "next/router"
import React, { useState } from "react"
import ReactDOM from "react-dom"

import { Renderer } from "../components/Renderer"
import { ExerciseTaskGradingResult } from "../shared-module/bindings"
import HeightTrackingContainer from "../shared-module/components/HeightTrackingContainer"
import { isSetStateMessage } from "../shared-module/exercise-service-protocol-types.guard"
import useExerciseServiceParentConnection from "../shared-module/hooks/useExerciseServiceParentConnection"
import { Alternative, Answer, ModelSolutionApi, PublicAlternative } from "../util/stateInterfaces"

import { ExerciseFeedback } from "./api/grade"

export interface SubmissionData {
  grading: ExerciseTaskGradingResult
  user_answer: Answer
  public_spec: PublicAlternative[]
}

export type State =
  | {
      view_type: "exercise"
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
  const [state, setState] = useState<State | null>(null)
  const router = useRouter()
  const rawMaxWidth = router?.query?.width
  let maxWidth: number | null = 500
  if (rawMaxWidth) {
    maxWidth = Number(rawMaxWidth)
  }

  const port = useExerciseServiceParentConnection((messageData) => {
    if (isSetStateMessage(messageData)) {
      ReactDOM.flushSync(() => {
        if (messageData.view_type === "exercise") {
          setState({
            view_type: messageData.view_type,
            public_spec: messageData.data.public_spec as PublicAlternative[],
          })
        } else if (messageData.view_type === "exercise-editor") {
          setState({
            view_type: messageData.view_type,
            private_spec:
              (JSON.parse(messageData.data.private_spec as string) as Alternative[]) || [],
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
    } else {
      // eslint-disable-next-line i18next/no-literal-string
      console.error("Frame received an unknown message from message port")
    }
  })

  return (
    <HeightTrackingContainer port={port}>
      <div
        className={css`
          width: 100%;
          ${maxWidth && `max-width: ${maxWidth}px;`}
          margin: 0 auto;
        `}
      >
        <Renderer port={port} setState={setState} state={state} />
      </div>
    </HeightTrackingContainer>
  )
}

export default Iframe
