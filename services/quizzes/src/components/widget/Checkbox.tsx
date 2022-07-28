import { css } from "@emotion/css"
import React from "react"

import MarkdownText from "../MarkdownText"

import { QuizItemComponentProps } from "."

const Checkbox: React.FC<React.PropsWithChildren<QuizItemComponentProps>> = ({
  quizItem,
  quizItemAnswerState,
  setQuizItemAnswerState,
}) => {
  const handleOptionToggle = (enabled: boolean) => {
    if (!quizItemAnswerState) {
      return
    }
    setQuizItemAnswerState({ ...quizItemAnswerState, intData: enabled ? 1 : 0, valid: true })
  }

  return (
    <div
      className={css`
        display: flex;
        flex-direction: row;
        flex-wrap: wrap;
        border: 3px solid #bec3c7;
        border-radius: 3px;
        margin-bottom: 10px;
        padding: 5px;
      `}
    >
      <div
        className={css`
          flex: 0.3;
          margin: 0.5rem;
          display: flex;
          justify-content: flex-end;
        `}
      >
        <input
          type="checkbox"
          checked={quizItemAnswerState?.intData === 1}
          onChange={(e) => handleOptionToggle(e.target.checked)}
          aria-label={quizItem.title}
        />
      </div>
      <div
        className={css`
          flex: 10;
          margin: 0.5rem;
        `}
      >
        {quizItem.title && <MarkdownText text={quizItem.title} />}
      </div>
    </div>
  )
}

export default Checkbox
