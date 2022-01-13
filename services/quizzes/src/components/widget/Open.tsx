import { css } from "@emotion/css"
import React, { useState } from "react"
import { useTranslation } from "react-i18next"

import { stripNonPrintableCharacters } from "../../shared-module/utils/strings"
import { MarkdownText } from "../MarkdownText"

import { QuizItemComponentProps } from "."

const Open: React.FC<QuizItemComponentProps> = ({
  quizItem,
  quizItemAnswerState,
  setQuizItemAnswerState,
}) => {
  const { t } = useTranslation()
  const [showFormatError, setShowFormatError] = useState(false)

  const handleChange = (newValue: string) => {
    if (!quizItemAnswerState) {
      return
    }

    if (!quizItem.formatRegex) {
      return setQuizItemAnswerState({ ...quizItemAnswerState, textData: newValue, valid: true })
    }

    const newValueIsValid = newValue
      ? answerFormatIsValidAgainstRegex(newValue, quizItem.formatRegex)
      : true
    setQuizItemAnswerState({ ...quizItemAnswerState, textData: newValue, valid: newValueIsValid })
  }

  const formatErrorVisible =
    showFormatError && quizItemAnswerState?.textData && !quizItemAnswerState?.valid

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
          aria-label={t("open-quiz-textfield")}
          type="text"
          value={quizItemAnswerState?.textData ?? ""}
          onChange={(e) => handleChange(e.target.value)}
          onFocus={() => setShowFormatError(true)}
          onBlur={() => setShowFormatError(false)}
        />
      </div>
      <div
        className={css`
          min-height: 1.5rem;
        `}
      >
        {formatErrorVisible ? (
          <>{t("error-answer-does-not-match-the-specified-answer-format")}</>
        ) : null}
      </div>
    </div>
  )
}

export default Open

const answerFormatIsValidAgainstRegex = (answer: string, validatorRegex: string): boolean => {
  const cleanedInput = stripNonPrintableCharacters(answer)
  // eslint-disable-next-line i18next/no-literal-string
  const validator = new RegExp(validatorRegex.trim(), "i")
  return validator.test(cleanedInput)
}
