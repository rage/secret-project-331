import { css } from "@emotion/css"
import _ from "lodash"
import React from "react"

import { UserItemAnswerChooseN } from "../../../../../types/quizTypes/answer"
import { PublicSpecQuizItemChooseN } from "../../../../../types/quizTypes/publicSpec"
import { respondToOrLarger } from "../../../../shared-module/common/styles/respond"
import withErrorBoundary from "../../../../shared-module/common/utils/withErrorBoundary"

import {
  QUIZ_TITLE_STYLE,
  TWO_DIMENSIONAL_BUTTON_SELECTED,
  TWO_DIMENSIONAL_BUTTON_STYLES,
} from "./AnswerQuizStyles"

import { QuizItemComponentProps } from "."

const ChooseN: React.FunctionComponent<
  React.PropsWithChildren<QuizItemComponentProps<PublicSpecQuizItemChooseN, UserItemAnswerChooseN>>
> = ({ quizItem, quizItemAnswerState, setQuizItemAnswerState }) => {
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

    const newItemAnswer: UserItemAnswerChooseN = {
      ...quizItemAnswerState,
      selectedOptionIds: selectedIds,
      valid: validAnswer,
    }

    setQuizItemAnswerState(newItemAnswer)
  }

  // Is it a dynamic color, because it was discarded in this PR
  // const selectedBackgroundColor = quizTheme.selectedItemBackground
  // const selectedForegroundColor = quizTheme.selectedItemColor

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
          ${QUIZ_TITLE_STYLE}
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
              ${TWO_DIMENSIONAL_BUTTON_STYLES}
              ${quizItemAnswerState?.selectedOptionIds?.includes(o.id) &&
              `
                ${TWO_DIMENSIONAL_BUTTON_SELECTED}
              `}
            `}
            disabled={
              quizItemAnswerState?.selectedOptionIds.length == quizItem.n &&
              !quizItemAnswerState?.selectedOptionIds?.includes(o.id)
            }
          >
            {o.title || o.body}
          </button>
        ))}
      </div>
    </div>
  )
}

export default withErrorBoundary(ChooseN)
