import { css } from "@emotion/css"
import _ from "lodash"
import React, { useState } from "react"

import { UserItemAnswerChooseN } from "../../../types/quizTypes/answer"
import { PublicSpecQuizItemChooseN } from "../../../types/quizTypes/publicSpec"
import { respondToOrLarger } from "../../shared-module/styles/respond"
import withErrorBoundary from "../../shared-module/utils/withErrorBoundary"
import { quizTheme } from "../../styles/QuizStyles"

import { QuizItemComponentProps } from "."

const ChooseN: React.FunctionComponent<
  React.PropsWithChildren<QuizItemComponentProps<PublicSpecQuizItemChooseN, UserItemAnswerChooseN>>
> = ({ quizItem, quizItemAnswerState, setQuizItemAnswerState }) => {
  const [optionsFull, setOptionsFull] = useState(false)

  const handleOptionSelect = (event: React.MouseEvent<HTMLButtonElement>) => {
    const selectedOptionId = event.currentTarget.value
    if (!quizItemAnswerState) {
      setQuizItemAnswerState({
        quizItemId: quizItem.id,
        type: "choose-n",
        selectedOptionIds: [selectedOptionId],
        valid: 1 == quizItem.n,
      })
      return
    }

    if (
      !quizItemAnswerState.selectedOptionIds.includes(selectedOptionId) &&
      quizItemAnswerState.selectedOptionIds.length == quizItem.n
    ) {
      return
    }
    const selectedIds = _.xor(quizItemAnswerState.selectedOptionIds, [selectedOptionId])
    const validAnswer = selectedIds.length == quizItem.n

    if (selectedIds.length == quizItem.n) {
      setOptionsFull(true)
    } else {
      setOptionsFull(false)
    }
    const newItemAnswer: UserItemAnswerChooseN = {
      ...quizItemAnswerState,
      selectedOptionIds: selectedIds,
      valid: validAnswer,
    }

    setQuizItemAnswerState(newItemAnswer)
  }

  const selectedBackgroundColor = quizTheme.selectedItemBackground
  const selectedForegroundColor = quizTheme.selectedItemColor

  return (
    <div
      className={css`
        display: flex;
        flex: 1;
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
              flex-grow: 1;
              margin: 0.5rem;
              border: none;
              ${quizItemAnswerState?.selectedOptionIds?.includes(o.id) &&
              `background-color: ${selectedBackgroundColor}; color: ${selectedForegroundColor}`}
            `}
            disabled={optionsFull && !quizItemAnswerState?.selectedOptionIds?.includes(o.id)}
          >
            {o.title || o.body}
          </button>
        ))}
      </div>
    </div>
  )
}

export default withErrorBoundary(ChooseN)
