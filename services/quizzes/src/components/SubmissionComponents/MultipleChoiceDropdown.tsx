import { css, cx } from "@emotion/css"
import React from "react"

import { ItemAnswerFeedback } from "../../pages/api/grade"
import { respondToOrLarger } from "../../shared-module/styles/respond"
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
  justify-content: center;
  align-items: center;
  background: ${quizTheme.gradingWrongItemBackground};
`

const MultipleChoiceDropdownFeedback: React.FC<QuizItemSubmissionComponentProps> = ({
  public_quiz_item,
  user_quiz_item_answer,
  quiz_item_feedback,
}) => {
  const correct = (quiz_item_feedback as ItemAnswerFeedback).quiz_item_correct
  const selectedOption = public_quiz_item.options.filter(
    (o) => o.id === (user_quiz_item_answer.optionAnswers as string[])[0],
  )[0]

  return (
    <div
      className={css`
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        ${respondToOrLarger.sm} {
          flex-direction: row;
        }
      `}
    >
      <div
        className={css`
          display: flex;
          flex: 3;
          margin: 0.5rem;
        `}
      >
        <h2>{public_quiz_item.title}</h2>
      </div>
      <p className={cx(correct ? correctAnswer : incorrectAnswer)}>
        {selectedOption.title || selectedOption.body}
      </p>
      <p>
        {(quiz_item_feedback as ItemAnswerFeedback).quiz_item_option_feedbacks?.map((of) => (
          <p key={of.option_id}>{of.option_feedback}</p>
        ))}
      </p>
    </div>
  )
}

export default MultipleChoiceDropdownFeedback
