import { css, cx } from "@emotion/css"
import React from "react"

import { UserItemAnswerMultiplechoiceDropdown } from "../../../types/quizTypes/answer"
import { ModelSolutionQuizItemMultiplechoiceDropdown } from "../../../types/quizTypes/modelSolutionSpec"
import { PublicSpecQuizItemMultiplechoiceDropdown } from "../../../types/quizTypes/publicSpec"
import { ItemAnswerFeedback } from "../../pages/api/grade"
import { respondToOrLarger } from "../../shared-module/styles/respond"
import withErrorBoundary from "../../shared-module/utils/withErrorBoundary"
import { quizTheme } from "../../styles/QuizStyles"

import { QuizItemSubmissionComponentProps } from "."

// eslint-disable-next-line i18next/no-literal-string
const correctAnswer = css`
  width: 100%;
  padding: 1rem;
  justify-content: center;
  align-items: center;
  margin: 0.5rem;
  border-radius: 3px;
  color: ${quizTheme.errorItemForegroundColor};
  background: ${quizTheme.gradingCorrectItemBackground};
`

// eslint-disable-next-line i18next/no-literal-string
const incorrectAnswer = css`
  width: 100%;
  padding: 1rem;
  justify-content: center;
  align-items: center;
  margin: 0.5rem;
  border-radius: 3px;
  color: ${quizTheme.gradingCorrectItemColor};
  background: ${quizTheme.gradingWrongItemBackground};
`

const MultipleChoiceDropdownFeedback: React.FC<
  React.PropsWithChildren<
    QuizItemSubmissionComponentProps<
      PublicSpecQuizItemMultiplechoiceDropdown,
      UserItemAnswerMultiplechoiceDropdown
    >
  >
> = ({ public_quiz_item, user_quiz_item_answer, quiz_item_feedback, quiz_item_model_solution }) => {
  const modelSolution = quiz_item_model_solution as ModelSolutionQuizItemMultiplechoiceDropdown
  const correct = (quiz_item_feedback as ItemAnswerFeedback).quiz_item_correct
  const selectedOption = public_quiz_item.options.filter(
    (o) => o.id === (user_quiz_item_answer.selectedOptionIds as string[])[0],
  )[0]
  const correctOption = modelSolution?.options.find((o) => o.correct)
  const correctBody = correctOption?.title || correctOption?.body

  return (
    <div
      className={css`
        display: flex;
        flex-direction: column;
        margin-top: 1rem;
      `}
    >
      <h2
        className={css`
          display: flex;
          margin: 0.5rem;
          font-family: "Raleway", sans-serif;
          font-weight: semi-bold;
          font-size: ${quizTheme.quizTitleFontSize} !important;
        `}
      >
        {public_quiz_item.title}
      </h2>
      <div
        className={css`
          display: flex;
          flex-direction: column;
          align-items: baseline;
          ${respondToOrLarger.sm} {
            flex-direction: row;
          }
        `}
      >
        {correct ? (
          <div className={cx(correctAnswer)}>{selectedOption.title || selectedOption.body}</div>
        ) : (
          <div
            className={css`
              display: flex;
              flex-direction: column;
              width: 100%;
            `}
          >
            <div className={cx(incorrectAnswer)}>{selectedOption.title || selectedOption.body}</div>
            {correctBody && (
              <div className={cx(correctAnswer)}>{correctOption?.title || correctOption?.body}</div>
            )}
          </div>
        )}
        <div
          className={css`
            display: flex;
            flex: 2;
            justify-content: center;
          `}
        >
          {quiz_item_feedback?.quiz_item_option_feedbacks?.map((of) => (
            <p key={of.option_id}>{of.option_feedback}</p>
          ))}
        </div>
      </div>
    </div>
  )
}

export default withErrorBoundary(MultipleChoiceDropdownFeedback)
