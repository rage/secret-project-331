import { css, cx } from "@emotion/css"
import React from "react"

import { ItemAnswerFeedback } from "../../pages/api/grade"
import { quizTheme } from "../../styles/QuizStyles"

import { QuizItemSubmissionComponentProps } from "."

const correctAnswer = css`
  display: flex;
  flex: 1;
  background: ${quizTheme.gradingCorrectItemBackground};
`

const incorrectAnswer = css`
  display: flex;
  flex: 1;
  background: ${quizTheme.gradingWrongItemBackground};
`

const OpenSubmission: React.FC<QuizItemSubmissionComponentProps> = ({
  public_quiz_item,
  quiz_item_feedback,
  user_quiz_item_answer,
}) => {
  const correct = user_quiz_item_answer.correct
  return (
    <div className={cx(correct ? correctAnswer : incorrectAnswer)}>
      <p>{public_quiz_item.title || public_quiz_item.body}</p>
      <p>{(quiz_item_feedback as ItemAnswerFeedback).quiz_item_feedback}</p>
    </div>
  )
}

export default OpenSubmission
