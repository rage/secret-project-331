import { css } from "@emotion/css"
import { useRouter } from "next/router"
import React, { useState } from "react"
import ReactDOM from "react-dom"
import { useTranslation } from "react-i18next"
import { v4 } from "uuid"

import { UserAnswer } from "../../types/quizTypes/answer"
import { ModelSolutionQuiz } from "../../types/quizTypes/modelSolutionSpec"
import { PrivateSpecQuiz } from "../../types/quizTypes/privateSpec"
import { PublicSpecQuiz } from "../../types/quizTypes/publicSpec"
import {
  ModelSolutionQuiz as oldModelSolutionQuiz,
  PublicQuiz,
  Quiz,
  QuizAnswer,
} from "../../types/types"
import Renderer from "../components/Renderer"
import { StudentExerciseTaskSubmissionResult } from "../shared-module/bindings"
import HeightTrackingContainer from "../shared-module/components/HeightTrackingContainer"
import {
  forgivingIsSetStateMessage,
  UserInformation,
} from "../shared-module/exercise-service-protocol-types"
import { isSetLanguageMessage } from "../shared-module/exercise-service-protocol-types.guard"
import useExerciseServiceParentConnection from "../shared-module/hooks/useExerciseServiceParentConnection"
import withErrorBoundary from "../shared-module/utils/withErrorBoundary"
import { COLUMN } from "../util/constants"
import { migrateQuiz } from "../util/migrate"
import { isOldQuiz } from "../util/migration/migrationSettings"
import migrateModelSolutionSpecQuiz from "../util/migration/modelSolutionSpecQuiz"
import { migratePrivateSpecQuiz } from "../util/migration/privateSpecQuiz"
import migratePublicSpecQuiz from "../util/migration/publicSpecQuiz"
import migrateQuizAnswer from "../util/migration/userAnswerSpec"

import { ItemAnswerFeedback } from "./api/grade"

export interface SubmissionData {
  submission_result: StudentExerciseTaskSubmissionResult
  user_answer: QuizAnswer
  public_spec: unknown
}

export type State =
  | {
      viewType: "answer-exercise"
      publicSpec: PublicSpecQuiz
      userInformation: UserInformation
      previousSubmission: UserAnswer | null
    }
  | {
      viewType: "view-submission"
      publicSpec: PublicSpecQuiz
      modelSolutions: ModelSolutionQuiz | null
      userAnswer: UserAnswer
      gradingFeedbackJson: ItemAnswerFeedback[] | null
      userInformation: UserInformation
    }
  | { viewType: "exercise-editor"; privateSpec: PrivateSpecQuiz; userInformation: UserInformation }

const IFrame: React.FC<React.PropsWithChildren<unknown>> = () => {
  const { i18n } = useTranslation()
  const [state, setState] = useState<State | null>(null)
  const router = useRouter()
  const rawMaxWidth = router?.query?.width
  let maxWidth: number | null = 500
  if (rawMaxWidth) {
    maxWidth = Number(rawMaxWidth)
  }

  const port = useExerciseServiceParentConnection((messageData) => {
    if (forgivingIsSetStateMessage(messageData)) {
      ReactDOM.flushSync(() => {
        if (messageData.view_type === "answer-exercise") {
          let public_spec = messageData.data.public_spec
          let quiz_answer = messageData.data.previous_submission
          if (isOldQuiz(messageData.data.previous_submission as QuizAnswer)) {
            quiz_answer = migrateQuizAnswer(
              messageData.data.previous_submission as QuizAnswer,
              public_spec as PublicSpecQuiz,
            )
          }
          if (isOldQuiz(public_spec as PublicQuiz)) {
            public_spec = migratePublicSpecQuiz(public_spec as PublicQuiz)
          }
          setState({
            viewType: messageData.view_type,
            publicSpec: public_spec as PublicSpecQuiz,
            userInformation: messageData.user_information,
            previousSubmission: quiz_answer as UserAnswer | null,
          })
        } else if (messageData.view_type === "exercise-editor") {
          console.log("Message data:", messageData)
          if (messageData.data.private_spec === null) {
            setState({
              viewType: messageData.view_type,
              privateSpec: migratePrivateSpecQuiz(emptyQuiz),
              userInformation: messageData.user_information,
            })
            return
          } else {
            let converted = messageData.data.private_spec
            if (!converted) {
              return
            }

            if (isOldQuiz(converted as Quiz)) {
              converted = migrateQuiz(converted)
              converted = migratePrivateSpecQuiz(converted as Quiz)
            }

            setState({
              viewType: messageData.view_type,
              privateSpec: converted as PrivateSpecQuiz,
              userInformation: messageData.user_information,
            })
          }
        } else if (messageData.view_type === "view-submission") {
          let public_spec = messageData.data.public_spec
          let model_solution_spec = messageData.data.model_solution_spec
          let quiz_answer = messageData.data.user_answer
          if (isOldQuiz(public_spec as PublicQuiz)) {
            public_spec = migratePublicSpecQuiz(public_spec as PublicQuiz)
          }
          if (isOldQuiz(model_solution_spec as PublicQuiz)) {
            model_solution_spec = migrateModelSolutionSpecQuiz(
              model_solution_spec as oldModelSolutionQuiz,
            )
          }
          if (isOldQuiz(messageData.data.user_answer as QuizAnswer)) {
            quiz_answer = migrateQuizAnswer(
              messageData.data.user_answer as QuizAnswer,
              public_spec as PublicSpecQuiz,
            )
          }
          setState({
            viewType: messageData.view_type,
            publicSpec: public_spec as PublicSpecQuiz,
            modelSolutions: model_solution_spec as ModelSolutionQuiz | null,
            userAnswer: quiz_answer as UserAnswer,
            userInformation: messageData.user_information,
            gradingFeedbackJson: messageData.data.grading?.feedback_json as
              | ItemAnswerFeedback[]
              | null,
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
  direction: COLUMN,
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

export default withErrorBoundary(IFrame)
