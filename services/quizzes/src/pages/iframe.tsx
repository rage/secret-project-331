import { css } from "@emotion/css"
import { useRouter } from "next/router"
import React, { useState } from "react"
import ReactDOM from "react-dom"
import { v4 } from "uuid"

import { ModelSolutionQuiz, PublicQuiz, Quiz, QuizAnswer } from "../../types/types"
import { Renderer } from "../components/Renderer"
import { StudentExerciseTaskSubmissionResult } from "../shared-module/bindings"
import HeightTrackingContainer from "../shared-module/components/HeightTrackingContainer"
import { isSetStateMessage } from "../shared-module/exercise-service-protocol-types.guard"
import useExerciseServiceParentConnection from "../shared-module/hooks/useExerciseServiceParentConnection"
import { migrateQuiz } from "../util/migrate"

import { ItemAnswerFeedback } from "./api/grade"

export interface SubmissionData {
  submission_result: StudentExerciseTaskSubmissionResult
  user_answer: QuizAnswer
  public_spec: unknown
}

export type State =
  | { viewType: "exercise"; publicSpec: PublicQuiz }
  | {
      viewType: "view-submission"
      publicSpec: PublicQuiz
      modelSolutions: ModelSolutionQuiz | null
      userAnswer: QuizAnswer
      gradingFeedbackJson: ItemAnswerFeedback[] | null
    }
  | { viewType: "exercise-editor"; privateSpec: Quiz }

const IFrame: React.FC<React.PropsWithChildren<unknown>> = () => {
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
            viewType: messageData.view_type,
            publicSpec: messageData.data.public_spec as PublicQuiz,
          })
        } else if (messageData.view_type === "exercise-editor") {
          if (messageData.data.private_spec === null) {
            setState({
              viewType: messageData.view_type,
              privateSpec: emptyQuiz,
            })
          } else {
            setState({
              viewType: messageData.view_type,
              privateSpec: migrateQuiz(JSON.parse(messageData.data.private_spec as string)),
            })
          }
        } else if (messageData.view_type === "view-submission") {
          setState({
            viewType: messageData.view_type,
            publicSpec: messageData.data.public_spec as PublicQuiz,
            modelSolutions: messageData.data.model_solution_spec as ModelSolutionQuiz | null,
            userAnswer: messageData.data.user_answer as QuizAnswer,
            gradingFeedbackJson: messageData.data.grading?.feedback_json as
              | ItemAnswerFeedback[]
              | null,
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

const DEFAULT_GRANT_POINTS_POLICY = "grant_whenever_possible"

// Empty quiz for newly created quiz exercises
const emptyQuiz: Quiz = {
  id: v4(),
  autoConfirm: true,
  autoReject: false,
  awardPointsEvenIfWrong: false,
  body: "",
  courseId: v4(),
  createdAt: new Date(),
  deadline: new Date(),
  excludedFromScore: true,
  grantPointsPolicy: DEFAULT_GRANT_POINTS_POLICY,
  items: [],
  part: 0,
  points: 0,
  section: 0,
  submitMessage: "",
  title: "",
  tries: 1,
  triesLimited: true,
  updatedAt: new Date(),
  open: new Date(),
}

export default IFrame
