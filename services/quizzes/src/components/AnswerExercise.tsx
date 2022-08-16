import React from "react"

import { PublicQuiz, QuizAnswer } from "../../types/types"

import Widget from "./widget"

export interface ExerciseProps {
  port: MessagePort
  publicSpec: PublicQuiz
  previousSubmission: QuizAnswer | null
}

const Exercise: React.FC<React.PropsWithChildren<ExerciseProps>> = ({
  port,
  publicSpec: quiz,
  previousSubmission,
}) => {
  return <Widget port={port} publicSpec={quiz} previousSubmission={previousSubmission} />
}

export default Exercise
