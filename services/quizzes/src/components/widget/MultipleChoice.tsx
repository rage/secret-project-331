import { css, cx } from "@emotion/css"
import _ from "lodash"
import React from "react"

import { QuizItemAnswer } from "../../../types/types"
import { respondToOrLarger } from "../../shared-module/styles/respond"
import { quizTheme } from "../../styles/QuizStyles"
import { MarkdownText } from "../MarkdownText"

import { QuizItemComponentProps } from "."

const DIRECTION_COLUMN = "column"
const DIRECTION_ROW = "row"

const optionButton = css`
  align-items: center;
  border: none;
  display: flex;
  flex: 1;
  justify-content: center;
  margin: 0.3rem;
  padding: 1rem;
`

const optionButtonColumn = css`
  ${respondToOrLarger.xs} {
    justify-content: left;
  }
`

// eslint-disable-next-line i18next/no-literal-string
const optionButtonSelected = css`
  background: ${quizTheme.selectedItemBackground};
  color: ${quizTheme.selectedItemColor};
`

export interface LeftBorderedDivProps {
  correct: boolean | undefined
  direction?: string
  message?: string
}

const MultipleChoice: React.FunctionComponent<QuizItemComponentProps> = ({
  quizItemAnswerState,
  quizItem,
  setQuizItemAnswerState,
}) => {
  // Column means that all the options are always diplayed on top of each other, regardless of the
  // device width. Sanitized since the value is used in CSS.
  const direction: "row" | "column" =
    quizItem.direction === DIRECTION_COLUMN ? DIRECTION_COLUMN : DIRECTION_ROW

  const handleOptionSelect = (event: React.MouseEvent<HTMLButtonElement>) => {
    if (!quizItemAnswerState) {
      return
    }

    const selectedOptionId = event.currentTarget.value
    let newItemAnswer: QuizItemAnswer
    // multi is set to true then student can select multiple options for an answer
    if (quizItem.multi) {
      newItemAnswer = {
        ...quizItemAnswerState,
        optionAnswers: _.xor(quizItemAnswerState.optionAnswers, [selectedOptionId]),
        valid: true,
      }
    } else {
      newItemAnswer = {
        ...quizItemAnswerState,
        optionAnswers: [selectedOptionId],
        valid: true,
      }
    }
    setQuizItemAnswerState(newItemAnswer)
  }

  return (
    <div
      className={css`
        margin: 0.5rem;
      `}
    >
      <div
        className={css`
          font-size: ${quizTheme.quizTitleFontSize};
          font-weight: bold;
        `}
      >
        {quizItem.title && <MarkdownText text={quizItem.title} />}
      </div>
      <p
        className={css`
          color: ${quizTheme.quizBodyColor};
          font-size: ${quizTheme.quizBodyFontSize};
          margin: 0.5rem 0;
        `}
      >
        {quizItem.body && <MarkdownText text={quizItem.body} />}
      </p>
      <div
        className={css`
          display: flex;
          flex-direction: column;

          ${respondToOrLarger.sm} {
            flex-direction: ${direction};
          }
        `}
      >
        {quizItem.options.map((qo) => {
          const selected = quizItemAnswerState?.optionAnswers?.includes(qo.id)

          return (
            <button
              key={qo.id}
              value={qo.id}
              onClick={handleOptionSelect}
              className={cx(
                optionButton,
                selected ? optionButtonSelected : "",
                direction === DIRECTION_COLUMN ? optionButtonColumn : "",
              )}
            >
              {qo.title || qo.body}
            </button>
          )
        })}
      </div>
    </div>
  )
}

export default MultipleChoice
