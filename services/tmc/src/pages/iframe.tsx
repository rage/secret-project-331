import { css } from "@emotion/css"
import { useRouter } from "next/router"
import React, { useState } from "react"
import ReactDOM from "react-dom"

import StateRenderer from "../components/StateRenderer"
import HeightTrackingContainer from "../shared-module/components/HeightTrackingContainer"
import { isSetStateMessage } from "../shared-module/exercise-service-protocol-types.guard"
import useExerciseServiceParentConnection from "../shared-module/hooks/useExerciseServiceParentConnection"
import withErrorBoundary from "../shared-module/utils/withErrorBoundary"
import {
  EditorExercisePublicSpec,
  ModelSolutionSpec,
  PrivateSpec,
  PublicSpec,
  State,
  UserAnswer,
} from "../util/stateInterfaces"

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
      console.log(messageData)
      ReactDOM.flushSync(() => {
        if (messageData.view_type === "answer-exercise") {
          setState({
            viewType: messageData.view_type,
            exerciseTaskId: messageData.exercise_task_id,
            publicSpec: messageData.data.public_spec as EditorExercisePublicSpec,
            previousSubmission: null, // todo messageData.data.previous_submission,
          })
        } else if (messageData.view_type === "exercise-editor") {
          const selectedRepositoryExercise = messageData.data.repository_exercise ?? null
          const incomingSpec = messageData.data.private_spec as PrivateSpec | null
          const privateSpec =
            incomingSpec ??
            (selectedRepositoryExercise
              ? { type: "editor", repository_exercise_id: selectedRepositoryExercise.id }
              : null)
          setState({
            viewType: messageData.view_type,
            exerciseTaskId: messageData.exercise_task_id,
            privateSpec,
            selectedRepositoryExercise,
          })
        } else if (messageData.view_type === "view-submission") {
          setState({
            viewType: messageData.view_type,
            exerciseTaskId: messageData.exercise_task_id,
            grading: messageData.data.grading,
            userAnswer: messageData.data.user_answer as UserAnswer,
            publicSpec: messageData.data.public_spec as PublicSpec,
            modelSolutionSpec: messageData.data.model_solution_spec as ModelSolutionSpec,
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
        <StateRenderer port={port} setState={setState} state={state} />
      </div>
    </HeightTrackingContainer>
  )
}

export default withErrorBoundary(Iframe)
