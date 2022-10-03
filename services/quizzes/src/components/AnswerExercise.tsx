import React from "react"

import { PublicQuiz, QuizAnswer } from "../../types/types"
import { UserInformation } from "../shared-module/exercise-service-protocol-types"

import Widget from "./widget"

export interface ExerciseProps {
  port: MessagePort
  publicSpec: PublicQuiz
  previousSubmission: QuizAnswer | null
  user_information: UserInformation
}

const Exercise: React.FC<React.PropsWithChildren<ExerciseProps>> = ({
  port,
  publicSpec: quiz,
  previousSubmission,
  user_information,
}) => {
  return (
    <Widget
      port={port}
      publicSpec={quiz}
      previousSubmission={previousSubmission}
      user_information={user_information}
    />
  )
}

export default Exercise
