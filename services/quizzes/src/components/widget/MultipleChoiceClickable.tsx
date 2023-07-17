import { css } from "@emotion/css"
import _ from "lodash"
import React from "react"

import { UserItemAnswerChooseN } from "../../../types/quizTypes/answer"
import { PublicSpecQuizItemChooseN } from "../../../types/quizTypes/publicSpec"
import { respondToOrLarger } from "../../shared-module/styles/respond"
import withErrorBoundary from "../../shared-module/utils/withErrorBoundary"
import { quizTheme } from "../../styles/QuizStyles"

import { QuizItemComponentProps } from "."

const MultipleChoiceClickable: React.FunctionComponent<
  React.PropsWithChildren<QuizItemComponentProps<PublicSpecQuizItemChooseN, UserItemAnswerChooseN>>
> = ({ quizItem, quizItemAnswerState, setQuizItemAnswerState }) => {
  const handleOptionSelect = (event: React.MouseEvent<HTMLButtonElement>) => {
    const selectedOptionId = event.currentTarget.value
    if (!quizItemAnswerState) {
      setQuizItemAnswerState({
        quizItemId: quizItem.id,
        type: "choose-n",
        selectedOptionIds: [selectedOptionId],
        valid: true,
      })
      return
    }

    const selectedIds = _.xor(quizItemAnswerState.selectedOptionIds, [selectedOptionId])
    const validAnswer = selectedIds.length > 0

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
          >
            {o.title || o.body}
          </button>
        ))}
      </div>
    </div>
  )
}

export default withErrorBoundary(MultipleChoiceClickable)
