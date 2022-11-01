import { css, cx } from "@emotion/css"
import React, { useState } from "react"
import { useTranslation } from "react-i18next"

import TextField from "../../shared-module/components/InputFields/TextField"
import { respondToOrLarger } from "../../shared-module/styles/respond"
import { stripNonPrintableCharacters } from "../../shared-module/utils/strings"
import withErrorBoundary from "../../shared-module/utils/withErrorBoundary"
import { ROW } from "../../util/constants"
import MarkdownText from "../MarkdownText"

import { QuizItemComponentProps } from "."

const wrapperRowExtraStyles = css`
  ${respondToOrLarger.sm} {
    align-items: center;
    column-gap: 0.2rem;
  }
`

const Open: React.FC<QuizItemComponentProps> = ({
  quizDirection,
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
      className={cx(
        css`
          display: flex;
          flex-direction: column;
          flex: 1;

          ${respondToOrLarger.sm} {
            flex-direction: ${quizDirection};
          }
        `,
        quizDirection === ROW ? wrapperRowExtraStyles : null,
      )}
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
