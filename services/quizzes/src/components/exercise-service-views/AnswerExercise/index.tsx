import React, { useCallback, useMemo, useState } from "react"
import { useTranslation } from "react-i18next"

import type { UserInformation } from "@/shared-module/exercise-protocol/core/exercise-service-protocol-types"

import type { UserAnswer } from "../../../../types/quizTypes/answer"
import type { PublicSpecQuiz } from "../../../../types/quizTypes/publicSpec"
import QuizzesUserItemAnswerContext from "../../../contexts/QuizzesUserItemAnswerContext"
import { getQuizValidityMessages } from "./getValidityMessages"
import AnswerExerciseImpl from "./impl-by-quiz-item-type"

export interface ExerciseProps {
  port: MessagePort
  publicSpec: PublicSpecQuiz
  previousSubmission: UserAnswer | null
  user_information: UserInformation
}

const Exercise: React.FC<React.PropsWithChildren<ExerciseProps>> = ({
  port,
  publicSpec,
  previousSubmission,
  user_information,
}) => {
  const { t } = useTranslation()
  const intialAnswer = useMemo(() => {
    if (previousSubmission) {
      return previousSubmission
    }
    return {
      itemAnswers: [],
      version: "2",
    } satisfies UserAnswer
  }, [previousSubmission])
  const [userAnswer, setUserAnswer] = useState<UserAnswer | null>(intialAnswer)

  const validate: (newState: UserAnswer | null) => boolean = useCallback(
    (newState) => {
      if (!newState || newState.itemAnswers.length < publicSpec.items.length) {
        return false
      }
      const validities = newState.itemAnswers.map((item) => item.valid)
      return validities.every(Boolean)
    },
    [publicSpec.items.length],
  )

  // Already-localized reasons the current answer is not yet submittable. Sent to the parent with the
  // `current-state` message so it can tell the student why the submit button is greyed out.
  const getValidityMessages = useCallback(
    (newState: UserAnswer | null): string[] =>
      getQuizValidityMessages(newState, publicSpec.items.length, (key) => t(key)),
    [publicSpec.items.length, t],
  )

  return (
    <QuizzesUserItemAnswerContext.Provider
      value={{
        outputState: userAnswer,
        port: port,
        _rawSetOutputState: setUserAnswer,
        validate,
        getValidityMessages,
      }}
    >
      <AnswerExerciseImpl
        publicSpec={publicSpec}
        previousSubmission={previousSubmission}
        user_information={user_information}
      />
    </QuizzesUserItemAnswerContext.Provider>
  )
}

export default Exercise
