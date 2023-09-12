import React, { useCallback, useMemo, useState } from "react"

import { UserAnswer } from "../../types/quizTypes/answer"
import { PublicSpecQuiz } from "../../types/quizTypes/publicSpec"
import QuizzesUserItemAnswerContext from "../contexts/QuizzesUserItemAnswerContext"
import { UserInformation } from "../shared-module/exercise-service-protocol-types"

import Widget from "./widget"

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

  return (
    <QuizzesUserItemAnswerContext.Provider
      value={{
        outputState: userAnswer,
        port: port,
        _rawSetOutputState: setUserAnswer,
        validate,
      }}
    >
      <Widget
        publicSpec={publicSpec}
        previousSubmission={previousSubmission}
        user_information={user_information}
      />
    </QuizzesUserItemAnswerContext.Provider>
  )
}

export default Exercise
