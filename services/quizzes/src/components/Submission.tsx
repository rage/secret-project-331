import React from "react"

import { ModelSolutionQuiz, PublicQuiz, QuizAnswer } from "../../types/types"

interface SubmissionProps {
  port: MessagePort
  maxWidth: number | null
  user_answer: QuizAnswer
  publicAlternatives: PublicQuiz
  modelSolutions: ModelSolutionQuiz
}

const Submission: React.FC<SubmissionProps> = ({ modelSolutions }) => {
  return <pre>{JSON.stringify(modelSolutions, undefined, 2)}</pre>
}

export default Submission
