import React, { useMemo, useState } from "react"

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
  publicSpec: quiz,
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

  return (
    <QuizzesUserItemAnswerContext.Provider
      value={{
        outputState: userAnswer,
        port: port,
        _rawSetOutputState: setUserAnswer,
        validate: (previousState) => {
          if (!previousState || previousState.itemAnswers.length == 0) {
            return false
          }
          const validities = previousState.itemAnswers.map((item) => item.valid)
          return validities.every(Boolean)
        },
      }}
    >
      <Widget
        port={port}
        publicSpec={quiz}
        previousSubmission={previousSubmission}
        user_information={user_information}
      />
    </QuizzesUserItemAnswerContext.Provider>
  )
}

export default Exercise
