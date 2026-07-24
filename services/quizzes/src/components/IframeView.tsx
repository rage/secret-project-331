import React, { useEffect, useRef, useState } from "react"
import ReactDOM from "react-dom"
import { useTranslation } from "react-i18next"

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
import {
  createEmptyPrivateSpec,
  migrateModelSolutionToLatest,
  migratePrivateSpecToLatest,
  migratePublicSpecToLatest,
  migrateUserAnswerToLatest,
} from "@/util/migration/migrateToLatest"
import type { StudentExerciseTaskSubmissionResult } from "@/utils/exerciseServiceApi"
import { setExerciseServiceReloadBridge } from "@/utils/iframeReloadBridge"

import type { OldQuizAnswer } from "../../types/oldQuizTypes"
import type { UserAnswer } from "../../types/quizTypes/answer"
import type { ItemAnswerFeedback } from "../../types/quizTypes/grading"
import type { ModelSolutionQuiz } from "../../types/quizTypes/modelSolutionSpec"
import type { PrivateSpecQuiz } from "../../types/quizTypes/privateSpec"
import type { PublicSpecQuiz } from "../../types/quizTypes/publicSpec"

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
          // Migrate the public spec first; the answer is then migrated against the migrated spec.
          const publicSpec = migratePublicSpecToLatest(messageData.data.public_spec)
          let quiz_answer = migrateUserAnswerToLatest(
            messageData.data.previous_submission,
            publicSpec,
          )

          // An exercise might be edited after the previous submission and some item answers in the previous submission might be for a quiz item that has been removed from the exercise.
          // We'll filter out those answers here so that we don't submit answers to non-existing quiz items.
          if (quiz_answer) {
            quiz_answer = {
              ...quiz_answer,
              itemAnswers: quiz_answer.itemAnswers.filter((itemAnswer) =>
                publicSpec.items.some((quizItem) => quizItem.id === itemAnswer.quizItemId),
              ),
            } satisfies UserAnswer
          }

          setState({
            viewType: messageData.view_type,
            publicSpec,
            userInformation: messageData.user_information,
            previousSubmission: quiz_answer,
          })
        } else if (messageData.view_type === "exercise-editor") {
          if (!isExerciseEditorIframeState(messageData)) {
            throw new Error(
              "Set-state message data is invalid for the specified exercise-editor view type",
            )
          }
          const privateSpec =
            messageData.data.private_spec === null || messageData.data.private_spec === undefined
              ? createEmptyPrivateSpec()
              : migratePrivateSpecToLatest(messageData.data.private_spec)

          setState({
            viewType: messageData.view_type,
            privateSpec,
            userInformation: messageData.user_information,
          })
        } else if (messageData.view_type === "view-submission") {
          if (!isViewSubmissionIframeState(messageData)) {
            throw new Error(
              "Set-state message data is invalid for the specified view-submission view type",
            )
          }
          const public_spec = migratePublicSpecToLatest(messageData.data.public_spec)
          const model_solution_spec = migrateModelSolutionToLatest(
            messageData.data.model_solution_spec,
          )
          const quiz_answer = migrateUserAnswerToLatest(messageData.data.user_answer, public_spec)
          setState({
            viewType: messageData.view_type,
            publicSpec: public_spec,
            modelSolutions: model_solution_spec,
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
