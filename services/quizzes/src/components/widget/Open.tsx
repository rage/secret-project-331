import { css } from "@emotion/css"
import React, { useState } from "react"

import { stripNonPrintableCharacters } from "../../shared-module/utils/strings"
import { MarkdownText } from "../MarkdownText"

import { QuizItemComponentProps } from "."

const Open: React.FC<QuizItemComponentProps> = ({
  quizItem,
  quizItemAnswerState,
  setQuizItemAnswerState,
}) => {
  const [showFormatError, setShowFormatError] = useState(false)
  const [valid, setValid] = useState(true)

  const handleChange = (newValue: string) => {
    if (!quizItemAnswerState) {
      return
    }

    if (!quizItem.formatRegex) {
      return setQuizItemAnswerState({ ...quizItemAnswerState, textData: newValue })
    }

    const newValueIsValid =
      newValue && quizItem.formatRegex
        ? answerFormatIsValidAgainstRegex(newValue, quizItem.formatRegex)
        : true
    setValid(newValueIsValid)
    setQuizItemAnswerState({ ...quizItemAnswerState, textData: newValue })
  }

  return (
    <div
      className={css`
        display: flex;
        flex-direction: column;
      `}
    >
      <div>{quizItem.title && <MarkdownText text={quizItem.title} />}</div>
      <div>{quizItem.body && <MarkdownText text={quizItem.body} />}</div>
      <div>
        <input
          type="text"
          value={quizItemAnswerState?.textData ?? ""}
          onChange={(e) => handleChange(e.target.value)}
          onFocus={() => setShowFormatError(true)}
          onBlur={() => setShowFormatError(false)}
        />
      </div>
      <div
        className={css`
          opacity: ${showFormatError && !valid ? 1 : 0};
        `}
      >
        The answer does not match the answer format specified for this exercise.
      </div>
    </div>
  )
}

export default Open

const answerFormatIsValidAgainstRegex = (answer: string, validatorRegex: string): boolean => {
  const cleanedInput = stripNonPrintableCharacters(answer)
  const validator = new RegExp(validatorRegex.trim(), "i")
  return validator.test(cleanedInput)
}
