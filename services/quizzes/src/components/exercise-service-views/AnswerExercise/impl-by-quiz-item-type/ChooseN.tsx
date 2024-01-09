import { css } from "@emotion/css"
import _ from "lodash"
import React from "react"

import { UserItemAnswerChooseN } from "../../../../../types/quizTypes/answer"
import { PublicSpecQuizItemChooseN } from "../../../../../types/quizTypes/publicSpec"
import { respondToOrLarger } from "../../../../shared-module/styles/respond"
import withErrorBoundary from "../../../../shared-module/utils/withErrorBoundary"
import { quizTheme } from "../../../../styles/QuizStyles"

import { QuizItemComponentProps } from "."

export const TWO_DIMENSIONAL_BUTTON_STYLES = `
  align-items: center;
  flex-grow: 1;
  appearance: none;
  background-color: #fcfcfd;
  border-radius: 0.625rem;
  border: 0.188rem solid #d6d6e7;
  box-shadow:
    rgba(45, 35, 66, 0) 0 2px 4px,
    rgba(45, 35, 66, 0) 0 7px 13px -3px,
    #d6d6e7 0 -2px 0 inset;
  color: #36395a;
  cursor: pointer;
  display: flex;
  min-height: 3rem;
  justify-content: center;
  line-height: 1;
  list-style: none;
  padding: 0.875rem;
  text-align: left;
  text-decoration: none;
  transition:
    box-shadow 0.15s,
    transform 0.15s;
  user-select: none;
  -webkit-user-select: none;
  touch-action: manipulation;
  white-space: nowrap;
  will-change: box-shadow, transform;
  font-size: 1.125rem;
  margin-bottom: 0.625rem;
  margin-right: 0.625rem;

    &:hover {
      background: #f1f4f9;
      border-color: #718dbf;
      box-shadow:
        rgba(45, 35, 66, 0) 0 4px 8px,
        rgba(45, 35, 66, 0) 0 7px 13px -3px,
        #718dbf 0 -2px 0 inset;
    }
`

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
          font-weight: 500;
          color: #4c5868;
          font-family: "Raleway", sans-serif;
          font-size: 20px;
          margin-bottom: 1rem;
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
              background: #f1f4f9;
              border-color: #718dbf;
              box-shadow:
                rgba(45, 35, 66, 0) 0 4px 8px,
                rgba(45, 35, 66, 0) 0 7px 13px -3px,
                #718dbf 0 -2px 0 inset;
              color: #4c5868;
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
