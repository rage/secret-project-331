import { css } from "@emotion/css"
import React from "react"

import { UserItemAnswerCheckbox } from "../../../../../types/quizTypes/answer"
import { PublicSpecQuizItemCheckbox } from "../../../../../types/quizTypes/publicSpec"
import ParsedText from "../../../ParsedText"

import { QuizItemComponentProps } from "."

import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"

const Checkbox: React.FC<
  QuizItemComponentProps<PublicSpecQuizItemCheckbox, UserItemAnswerCheckbox>
> = ({ quizItem, quizItemAnswerState, setQuizItemAnswerState }) => {
  const handleOptionToggle = (enabled: boolean) => {
    if (!quizItemAnswerState) {
      // Not answered before, create a new answer
      setQuizItemAnswerState({
        checked: enabled,
        valid: true,
        type: "checkbox",
        quizItemId: quizItem.id,
      })
      return
    }
    // Answered before, update the answer
    setQuizItemAnswerState({ ...quizItemAnswerState, checked: enabled, valid: true })
  }

  return (
    <div
      className={css`
        display: flex;
        flex: 1;
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
          checked={quizItemAnswerState?.checked}
          onChange={(e) => handleOptionToggle(e.target.checked)}
          aria-label={quizItem.title ?? undefined}
        />
      </div>
      <div
        className={css`
          flex: 10;
          margin: 0.5rem;
        `}
      >
        {quizItem.title && <ParsedText inline parseLatex parseMarkdown text={quizItem.title} />}
      </div>
    </div>
  )
}

export default withErrorBoundary(Checkbox)
