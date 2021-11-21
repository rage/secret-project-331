/* eslint-disable i18next/no-literal-string */
import { css } from "@emotion/css"
import _ from "lodash"
import React from "react"

import { QuizItemAnswer } from "../../../types/types"
import { respondToOrLarger } from "../../shared-module/styles/respond"
import { MarkdownText } from "../MarkdownText"

import { QuizItemComponentProps } from "."

export interface LeftBorderedDivProps {
  correct: boolean | undefined
  direction?: string
  message?: string
}

const Matrix: React.FunctionComponent<QuizItemComponentProps> = ({
  quizItemAnswerState,
  quizItem,
  setQuizItemAnswerState,
}) => {
  const direction = quizItem.direction || "row"

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

  // 2 directions
  // render title and body
  // render options

  // direction row = everything in one row

  if (direction === "row") {
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
        <div
          className={css`
            display: flex;
            flex-direction: column;
            flex: 1;
            margin: 0.5rem;
          `}
        >
          {quizItem.title && <MarkdownText text={quizItem.title} />}
          {quizItem.body && <MarkdownText text={quizItem.body} />}
        </div>
        <div
          className={css`
            display: flex;
            flex: 2;
            flex-direction: column;
            justify-content: space-between;
            ${respondToOrLarger.sm} {
              flex-direction: row;
            }
          `}
        >
          {quizItem.options.map((qo) => {
            return (
              <button
                key={qo.id}
                value={qo.id}
                onClick={handleOptionSelect}
                className={css`
                  display: flex;
                  margin: 0.5rem;
                  flex: 2;
                  justify-content: center;
                  align-items: center;
                  ${quizItemAnswerState?.optionAnswers?.includes(qo.id) &&
                  "border: 2px solid #4caf50; /* Green */"}
                `}
              >
                {qo.title || qo.body}
              </button>
            )
          })}
        </div>
      </div>
    )
  }

  // direction column = everything stacked

  return (
    <div
      className={css`
        display: flex;
        flex-direction: column;
      `}
    >
      <div
        className={css`
          display: flex;
          margin: 0.5rem;
        `}
      >
        {quizItem.title && <MarkdownText text={quizItem.title} />}
      </div>
      <div
        className={css`
          display: flex;
          margin: 0.5rem;
        `}
      >
        {quizItem.body && <MarkdownText text={quizItem.body} />}
      </div>
      {quizItem.options.map((qo) => {
        return (
          <button
            key={qo.id}
            value={qo.id}
            onClick={handleOptionSelect}
            className={css`
              display: flex;
              margin: 0.5rem;
              flex: 1;
              justify-content: center;
              ${quizItemAnswerState?.optionAnswers?.includes(qo.id) &&
              "border: 2px solid #4caf50; /* Green */"}
            `}
          >
            {qo.title || qo.body}
          </button>
        )
      })}
    </div>
  )
}

export default Matrix
