import React from "react"

import { ModelSolutionQuiz, PublicQuiz, QuizAnswer } from "../../types/types"
import HeightTrackingContainer from "../shared-module/components/HeightTrackingContainer"

interface SubmissionProps {
  port: MessagePort
  maxWidth: number | null
  user_answer: QuizAnswer
  publicAlternatives: PublicQuiz
  modelSolutions: ModelSolutionQuiz
}

const Submission: React.FC<SubmissionProps> = ({ modelSolutions, port }) => {
  return (
    <HeightTrackingContainer port={port}>
      <pre>{JSON.stringify(modelSolutions, undefined, 2)}</pre>
    </HeightTrackingContainer>
  )
}

export default Submission
