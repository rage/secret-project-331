import React from "react"

import { QuizItemSubmissionComponentProps } from "../Submission"

const EssayFeedback: React.FC<QuizItemSubmissionComponentProps> = ({ public_quiz_item }) => {
  return <p>{public_quiz_item.title || public_quiz_item.body}</p>
}

export default EssayFeedback
