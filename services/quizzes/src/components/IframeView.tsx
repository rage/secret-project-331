import React, { useEffect, useRef, useState } from "react"
import ReactDOM from "react-dom"
import { useTranslation } from "react-i18next"

import type {
  OldModelSolutionQuiz as oldModelSolutionQuiz,
  OldPublicQuiz,
  OldQuiz,
  OldQuizAnswer,
} from "../../types/oldQuizTypes"
import type { UserAnswer } from "../../types/quizTypes/answer"
import type { ItemAnswerFeedback } from "../../types/quizTypes/grading"
import type { ModelSolutionQuiz } from "../../types/quizTypes/modelSolutionSpec"
import type { PrivateSpecQuiz } from "../../types/quizTypes/privateSpec"
import type { PublicSpecQuiz } from "../../types/quizTypes/publicSpec"

import Renderer from "@/components/exercise-service-views/Renderer"
import MessagePortContext from "@/contexts/MessagePortContext"
import type { UserInformation } from "@/shared-module/exercise-protocol/core/exercise-service-protocol-types"
import { forgivingIsSetStateMessage } from "@/shared-module/exercise-protocol/core/exercise-service-protocol-types"
import {
  isAnswerExerciseIframeState,
  isExerciseEditorIframeState,
  isSetLanguageMessage,
  isViewSubmissionIframeState,
} from "@/shared-module/exercise-protocol/core/exercise-service-protocol-types.guard"
import HeightTrackingContainer from "@/shared-module/exercise-react/react/components/HeightTrackingContainer"
import useExerciseServiceParentConnection from "@/shared-module/exercise-react/react/hooks/useExerciseServiceParentConnection"
import { migrateQuiz } from "@/util/migrate"
import { isOldQuiz } from "@/util/migration/migrationSettings"
import migrateModelSolutionSpecQuiz from "@/util/migration/modelSolutionSpecQuiz"
import { migratePrivateSpecQuiz } from "@/util/migration/privateSpecQuiz"
import migratePublicSpecQuiz from "@/util/migration/publicSpecQuiz"
import migrateQuizAnswer from "@/util/migration/userAnswerSpec"
import type { StudentExerciseTaskSubmissionResult } from "@/utils/exerciseServiceApi"
import { setExerciseServiceReloadBridge } from "@/utils/iframeReloadBridge"

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

const IframeView: React.FC = () => {
  const { i18n } = useTranslation()
  const [state, setState] = useState<State | null>(null)
  const reloadBridgeCleanupRef = useRef<(() => void) | null>(null)
  const reloadBridgePortRef = useRef<MessagePort | null>(null)

  const port = useExerciseServiceParentConnection((messageData, messagePort) => {
    if (reloadBridgePortRef.current !== messagePort) {
      reloadBridgeCleanupRef.current?.()
      reloadBridgeCleanupRef.current = setExerciseServiceReloadBridge(messagePort)
      reloadBridgePortRef.current = messagePort
    }

    if (forgivingIsSetStateMessage(messageData)) {
      ReactDOM.flushSync(() => {
        if (messageData.view_type === "answer-exercise") {
          if (!isAnswerExerciseIframeState(messageData)) {
            throw new Error(
              "Set-state message data is invalid for the specified answer-exercise view type",
            )
          }
          let publicSpec = messageData.data.public_spec
          let quiz_answer = messageData.data.previous_submission

          if (isOldQuiz(messageData.data.previous_submission as OldQuizAnswer)) {
            quiz_answer = migrateQuizAnswer(
              // oxlint-disable-next-line typescript/no-explicit-any
              (messageData.data.previous_submission as any)?.private_spec as OldQuizAnswer,
              publicSpec as PublicSpecQuiz,
            )
          }
          if (isOldQuiz(publicSpec as OldPublicQuiz)) {
            publicSpec = migratePublicSpecQuiz(publicSpec as OldPublicQuiz)
          }
          // An exercise might be edited after the previous submission and some item answers in the previous submission might be for a quiz item that has been removed from the exercise.
          // We'll filter out those answers here so that we don't submit answers to non-existing quiz items.
          if (quiz_answer) {
            quiz_answer = {
              ...(quiz_answer as UserAnswer),
              itemAnswers: (quiz_answer as UserAnswer).itemAnswers.filter((itemAnswer) =>
                (publicSpec as PublicSpecQuiz).items.some(
                  (quizItem) => quizItem.id === itemAnswer.quizItemId,
                ),
              ),
            } satisfies UserAnswer
          }

          setState({
            viewType: messageData.view_type,
            publicSpec: publicSpec as PublicSpecQuiz,
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
                // oxlint-disable-next-line i18next/no-literal-string
                grantPointsPolicy: "grant_whenever_possible",
                // oxlint-disable-next-line i18next/no-literal-string
                quizItemDisplayDirection: "vertical",
                submitMessage: null,
                items: [],
              } satisfies PrivateSpecQuiz,
              userInformation: messageData.user_information,
            })
            return
          }
          let converted: unknown = privateSpec

          // oxlint-disable-next-line typescript/no-explicit-any
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
              // oxlint-disable-next-line i18next/no-literal-string
              grantPointsPolicy: "grant_whenever_possible",
              submitMessage: null,
              // oxlint-disable-next-line i18next/no-literal-string
              quizItemDisplayDirection: "vertical",
              items: [],
            } satisfies PrivateSpecQuiz
          }

          setState({
            viewType: messageData.view_type,
            privateSpec: converted as PrivateSpecQuiz,
            userInformation: messageData.user_information,
          })
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
              // oxlint-disable-next-line typescript/no-explicit-any
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
          console.error("Unknown view type received from parent")
        }
      })
    } else if (isSetLanguageMessage(messageData)) {
      i18n.changeLanguage(messageData.data)
    } else {
      console.error("Frame received an unknown message from message port")
    }
  })

  useEffect(() => {
    return () => {
      reloadBridgeCleanupRef.current?.()
      reloadBridgeCleanupRef.current = null
      reloadBridgePortRef.current = null
    }
  }, [])

  return (
    <HeightTrackingContainer port={port}>
      <MessagePortContext.Provider value={port}>
        <div>
          <Renderer port={port} setState={setState} state={state} />
        </div>
      </MessagePortContext.Provider>
    </HeightTrackingContainer>
  )
}

export default IframeView
