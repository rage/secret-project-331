import { css } from "@emotion/css"
import React, { useState } from "react"
import { useTranslation } from "react-i18next"

import TextField from "../../shared-module/components/InputFields/TextField"
import { stripNonPrintableCharacters } from "../../shared-module/utils/strings"
import withErrorBoundary from "../../shared-module/utils/withErrorBoundary"
import MarkdownText from "../MarkdownText"

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
        <TextField
          aria-label={t("answer")}
          label={t("answer")}
          type="text"
          value={quizItemAnswerState?.textData ?? ""}
          onChange={(e) => handleChange(e)}
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

const answerFormatIsValidAgainstRegex = (answer: string, validatorRegex: string): boolean => {
  const cleanedInput = stripNonPrintableCharacters(answer)
  // eslint-disable-next-line i18next/no-literal-string
  const validator = new RegExp(validatorRegex.trim(), "i")
  return validator.test(cleanedInput)
}

export default withErrorBoundary(Open)
