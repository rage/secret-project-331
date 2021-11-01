import { css } from "@emotion/css"
import _ from "lodash"
import React from "react"

import { QuizItemAnswer } from "../../../types/types"
import { respondToOrLarger } from "../../shared-module/styles/respond"

import { QuizItemComponentProps } from "."

export const MultipleChoiceClickable: React.FunctionComponent<QuizItemComponentProps> = ({
  quizItem,
  quizItemAnswerState,
  setQuizItemAnswerState,
}) => {
  const handleOptionSelect = (event: React.MouseEvent<HTMLButtonElement>) => {
    if (!quizItemAnswerState) {
      return
    }
    const selectedOptionId = event.currentTarget.value
    const selectedIds = _.xor(quizItemAnswerState.optionAnswers, [selectedOptionId])
    const validAnswer = selectedIds.length > 0

    const newItemAnswer: QuizItemAnswer = {
      ...quizItemAnswerState,
      optionAnswers: selectedIds,
      valid: validAnswer,
    }

    setQuizItemAnswerState(newItemAnswer)
  }

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
        {quizItem.title || quizItem.body}
      </h2>
      <div
        className={css`
          display: flex;
          flex-wrap: wrap;
        `}
      >
        {quizItem.options.map((o) => (
          <button
            key={o.id}
            value={o.id}
            onClick={handleOptionSelect}
            className={css`
              display: flex;
              margin: 0.5rem;
              ${quizItemAnswerState?.optionAnswers?.includes(o.id) && "border: 2px solid #4caf50;"}
            `}
          >
            {o.title || o.body}
          </button>
        ))}
      </div>
    </div>
  )
}
