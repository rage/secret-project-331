import React from "react"

import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"

import type { QuizItemSubmissionComponentProps } from "."
import type { UserItemAnswerScale } from "../../../../../types/quizTypes/answer"
import type { PublicSpecQuizItemScale } from "../../../../../types/quizTypes/publicSpec"
import { ScaleView } from "../../AnswerExercise/impl-by-quiz-item-type/Scale"

const Scale: React.FC<
  QuizItemSubmissionComponentProps<PublicSpecQuizItemScale, UserItemAnswerScale>
> = ({ public_quiz_item, user_quiz_item_answer }) => {
  return (
    <ScaleView
      quizItem={public_quiz_item}
      selectedValue={user_quiz_item_answer?.intData}
      disabled
    />
  )
}

export default withErrorBoundary(Scale)
