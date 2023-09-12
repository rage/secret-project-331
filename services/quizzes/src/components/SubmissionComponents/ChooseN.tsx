import { css } from "@emotion/css"
import React from "react"

import { UserItemAnswerChooseN } from "../../../types/quizTypes/answer"
import { ModelSolutionQuizItemChooseN } from "../../../types/quizTypes/modelSolutionSpec"
import { PublicSpecQuizItemChooseN } from "../../../types/quizTypes/publicSpec"
import { respondToOrLarger } from "../../shared-module/styles/respond"
import withErrorBoundary from "../../shared-module/utils/withErrorBoundary"
import { quizTheme } from "../../styles/QuizStyles"

import { QuizItemSubmissionComponentProps } from "."

const MultipleChoiceClickableFeedback: React.FC<
  React.PropsWithChildren<
    QuizItemSubmissionComponentProps<PublicSpecQuizItemChooseN, UserItemAnswerChooseN>
  >
> = ({ user_quiz_item_answer, public_quiz_item, quiz_item_model_solution }) => {
  const modelSolution = quiz_item_model_solution as ModelSolutionQuizItemChooseN
  return (
    <div
      className={css`
        display: flex;
        flex-direction: column;
        ${respondToOrLarger.md} {
          flex-direction: row;
        }
      `}
    >
      <h2
        className={css`
          display: flex;
        `}
      >
        {public_quiz_item.title || public_quiz_item.body}
      </h2>
      <div
        className={css`
          display: flex;
          flex-wrap: wrap;
        `}
      >
        {public_quiz_item.options.map((o) => {
          const optionSelected = user_quiz_item_answer.selectedOptionIds?.includes(o.id)
          const correct = modelSolution?.options.find((mo) => o.id === mo.id)?.correct

          const backgroundColor = correct
            ? quizTheme.gradingCorrectItemBackground
            : quizTheme.gradingWrongItemBackground
          const foregroundColor = correct
            ? quizTheme.gradingCorrectItemColor
            : quizTheme.gradingWrongItemColor

          return (
            <button
              key={o.id}
              value={o.id}
              disabled
              className={css`
                display: flex;
                margin: 0.5rem;
                flex-grow: 1;
                color: ${foregroundColor};
                background-color: ${backgroundColor};
                border: ${optionSelected ? `2px solid black` : "none"};
              `}
            >
              {o.title || o.body}
            </button>
          )
        })}
      </div>
    </div>
  )
}

export default withErrorBoundary(MultipleChoiceClickableFeedback)
