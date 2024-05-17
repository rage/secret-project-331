import { css } from "@emotion/css"
import React, { useCallback, useId } from "react"
import { useTranslation } from "react-i18next"

import { UserItemAnswerClosedEndedQuestion } from "../../../../../types/quizTypes/answer"
import { PublicSpecQuizItemClosedEndedQuestion } from "../../../../../types/quizTypes/publicSpec"
import TextField from "../../../../shared-module/common/components/InputFields/TextField"
import { stripNonPrintableCharacters } from "../../../../shared-module/common/utils/strings"
import withErrorBoundary from "../../../../shared-module/common/utils/withErrorBoundary"
import MarkdownText from "../../../MarkdownText"
import CloseEndedQuestionWrapper from "../../../Shared/CloseEndedQuestionWrapper"

import { QuizItemComponentProps } from "."

const ClosedEndedQuestion: React.FC<
  QuizItemComponentProps<PublicSpecQuizItemClosedEndedQuestion, UserItemAnswerClosedEndedQuestion>
> = ({ quizDirection, quizItem, quizItemAnswerState, setQuizItemAnswerState }) => {
  const { t } = useTranslation()
  const fieldId = useId()

  const validateAnswer = useCallback(
    (answer: string) => {
      if (quizItem.formatRegex) {
        return answer.length > 0 && answerFormatIsValidAgainstRegex(answer, quizItem.formatRegex)
      } else {
        return answer.length > 0
      }
    },
    [quizItem.formatRegex],
  )

  const handleChange = useCallback(
    (newValue: string) => {
      if (!quizItemAnswerState) {
        setQuizItemAnswerState({
          quizItemId: quizItem.id,
          type: "closed-ended-question",
          textData: newValue,
          valid: validateAnswer(newValue),
        })
        return
      }

      const newValueIsValid = validateAnswer(newValue)
      setQuizItemAnswerState({ ...quizItemAnswerState, textData: newValue, valid: newValueIsValid })
    },
    [quizItem.id, quizItemAnswerState, setQuizItemAnswerState, validateAnswer],
  )

  const formatErrorVisible =
    !answerFormatIsValidAgainstRegex(quizItemAnswerState?.textData, quizItem.formatRegex ?? "") &&
    quizItemAnswerState?.textData &&
    !quizItemAnswerState?.valid

  return (
    <CloseEndedQuestionWrapper wideScreenDirection={quizDirection}>
      <div>
        {quizItem.title && <ParsedText inline parseLatex parseMarkdown text={quizItem.title} />}
      </div>
      <div>
        {quizItem.body && <ParsedText inline parseLatex parseMarkdown text={quizItem.body} />}
      </div>
      <div>
        <TextField
          id={fieldId}
          aria-label={t("answer")}
          label={t("answer")}
          type="text"
          className={css`
            label {
              font-weight: 500;
              color: #4c5868;
              font-family: "Raleway", sans-serif;
              font-size: 0.938rem;
              margin-bottom: 1rem;
            }
            input {
              background: #f4f5f7 !important;
              border-radius: 0.25rem;
              border: 0.188rem solid #dfe1e6 !important;
            }
          `}
          value={quizItemAnswerState?.textData ?? ""}
          onChangeByValue={(e) => handleChange(e)}
          error={
            formatErrorVisible
              ? t("error-answer-does-not-match-the-specified-answer-format")
              : undefined
          }
        />
      </div>
    </CloseEndedQuestionWrapper>
  )
}

const answerFormatIsValidAgainstRegex = (
  answer: string | undefined,
  validatorRegex: string | undefined,
): boolean => {
  if (answer?.length == 0) {
    return true
  }
  if (!answer || !validatorRegex) {
    return false
  }
  const cleanedInput = stripNonPrintableCharacters(answer)
  // eslint-disable-next-line i18next/no-literal-string
  const validator = new RegExp(validatorRegex.trim())
  return validator.test(cleanedInput)
}

export default withErrorBoundary(ClosedEndedQuestion)
