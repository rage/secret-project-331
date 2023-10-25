import { css } from "@emotion/css"
import { useRouter } from "next/router"
import React, { useState } from "react"
import ReactDOM from "react-dom"
import { useTranslation } from "react-i18next"

import {
  OldModelSolutionQuiz as oldModelSolutionQuiz,
  OldPublicQuiz,
  OldQuiz,
  OldQuizAnswer,
} from "../../types/oldQuizTypes"
import { UserAnswer } from "../../types/quizTypes/answer"
import { ModelSolutionQuiz } from "../../types/quizTypes/modelSolutionSpec"
import { PrivateSpecQuiz } from "../../types/quizTypes/privateSpec"
import { PublicSpecQuiz } from "../../types/quizTypes/publicSpec"
import Renderer from "../components/exercise-service-views/Renderer"
import { ItemAnswerFeedback } from "../grading/feedback"
import { StudentExerciseTaskSubmissionResult } from "../shared-module/bindings"
import HeightTrackingContainer from "../shared-module/components/HeightTrackingContainer"
import {
  forgivingIsSetStateMessage,
  UserInformation,
} from "../shared-module/exercise-service-protocol-types"
import {
  isAnswerExerciseIframeState,
  isExerciseEditorIframeState,
  isSetLanguageMessage,
  isViewSubmissionIframeState,
} from "../shared-module/exercise-service-protocol-types.guard"
import useExerciseServiceParentConnection from "../shared-module/hooks/useExerciseServiceParentConnection"
import withErrorBoundary from "../shared-module/utils/withErrorBoundary"
import { migrateQuiz } from "../util/migrate"
import { isOldQuiz } from "../util/migration/migrationSettings"
import migrateModelSolutionSpecQuiz from "../util/migration/modelSolutionSpecQuiz"
import { migratePrivateSpecQuiz } from "../util/migration/privateSpecQuiz"
import migratePublicSpecQuiz from "../util/migration/publicSpecQuiz"
import migrateQuizAnswer from "../util/migration/userAnswerSpec"

export interface SubmissionData {
  submission_result: StudentExerciseTaskSubmissionResult
  user_answer: OldQuizAnswer
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
          if (!isAnswerExerciseIframeState(messageData)) {
            throw new Error(
              "Set-state message data is invalid for the specified answer-exercise view type",
            )
          }
          let public_spec = messageData.data.public_spec
          let quiz_answer = messageData.data.previous_submission
          if (isOldQuiz(messageData.data.previous_submission as OldQuizAnswer)) {
            quiz_answer = migrateQuizAnswer(
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              (messageData.data.previous_submission as any)?.private_spec as OldQuizAnswer,
              public_spec as PublicSpecQuiz,
            )
          }
          if (isOldQuiz(public_spec as OldPublicQuiz)) {
            public_spec = migratePublicSpecQuiz(public_spec as OldPublicQuiz)
          }
          setState({
            viewType: messageData.view_type,
            publicSpec: public_spec as PublicSpecQuiz,
            userInformation: messageData.user_information,
            previousSubmission: quiz_answer as UserAnswer | null,
          })
        } else if (messageData.view_type === "exercise-editor") {
          if (!isExerciseEditorIframeState(messageData)) {
            throw new Error(
              "Set-state message data is invalid for the specified exercise-editor view type",
            )
          }
          const privateSpec = messageData.data.private_spec
          if (privateSpec === null) {
            setState({
              viewType: messageData.view_type,
              privateSpec: {
                version: "2",
                title: null,
                body: null,
                awardPointsEvenIfWrong: false,
                grantPointsPolicy: "grant_whenever_possible",
                quizItemDisplayDirection: "vertical",
                submitMessage: null,
                items: [],
              } satisfies PrivateSpecQuiz,
              userInformation: messageData.user_information,
            })
            return
          } else {
            let converted: unknown = privateSpec

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            if (isOldQuiz(converted as any)) {
              converted = migrateQuiz(converted)
              converted = migratePrivateSpecQuiz(converted as OldQuiz)
            }

            if (converted === null || converted === undefined) {
              // The quiz was just created, intialize it with empty values
              converted = {
                version: "2",
                title: null,
                body: null,
                awardPointsEvenIfWrong: false,
                grantPointsPolicy: "grant_whenever_possible",
                submitMessage: null,
                quizItemDisplayDirection: "vertical",
                items: [],
              } satisfies PrivateSpecQuiz
            }

            setState({
              viewType: messageData.view_type,
              privateSpec: converted as PrivateSpecQuiz,
              userInformation: messageData.user_information,
            })
          }
        } else if (messageData.view_type === "view-submission") {
          if (!isViewSubmissionIframeState(messageData)) {
            throw new Error(
              "Set-state message data is invalid for the specified view-submission view type",
            )
          }
          let public_spec = messageData.data.public_spec
          let model_solution_spec = messageData.data.model_solution_spec
          let quiz_answer = messageData.data.user_answer
          if (isOldQuiz(public_spec as OldPublicQuiz)) {
            public_spec = migratePublicSpecQuiz(public_spec as OldPublicQuiz)
          }
          if (isOldQuiz(model_solution_spec as OldPublicQuiz)) {
            model_solution_spec = migrateModelSolutionSpecQuiz(
              model_solution_spec as oldModelSolutionQuiz,
            )
          }
          if (isOldQuiz(messageData.data.user_answer as OldQuizAnswer)) {
            quiz_answer = migrateQuizAnswer(
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              messageData.data.user_answer as any as OldQuizAnswer,
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

export default withErrorBoundary(IFrame)
