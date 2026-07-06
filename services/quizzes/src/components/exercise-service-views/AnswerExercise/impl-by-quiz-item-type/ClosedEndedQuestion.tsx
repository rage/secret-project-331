"use client"

import { css } from "@emotion/css"
import React, { useCallback, useId } from "react"
import { useTranslation } from "react-i18next"

import { UserItemAnswerClosedEndedQuestion } from "../../../../../types/quizTypes/answer"
import { PublicSpecQuizItemClosedEndedQuestion } from "../../../../../types/quizTypes/publicSpec"
import ParsedText from "../../../ParsedText"
import CloseEndedQuestionWrapper from "../../../Shared/CloseEndedQuestionWrapper"

import { QuizItemComponentProps } from "."

import TextField from "@/shared-module/common/components/InputFields/TextField"
import { stripNonPrintableCharacters } from "@/shared-module/common/utils/strings"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"
import { primaryFont } from "@/shared-module/exercise-react/styles"

const ClosedEndedQuestion: React.FC<
  QuizItemComponentProps<PublicSpecQuizItemClosedEndedQuestion, UserItemAnswerClosedEndedQuestion>
> = ({ quizDirection, quizItem, quizItemAnswerState, setQuizItemAnswerState }) => {
  const { t } = useTranslation()
  const fieldId = useId()
  const titleId = useId()
  const bodyId = useId()
  // The given word (title) is the field's accessible name; the instruction (body), when present,
  // is its description. Reference only the parts that are actually rendered (WCAG 1.3.1). When
  // there is no title, fall back to the body as the accessible name so the field is never unnamed.
  const labelledBy = quizItem.title ? titleId : quizItem.body ? bodyId : undefined
  const describedBy = quizItem.title && quizItem.body ? bodyId : undefined

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
      <div id={titleId}>
        {quizItem.title && <ParsedText inline parseLatex parseMarkdown text={quizItem.title} />}
      </div>
      <div id={bodyId}>
        {quizItem.body && <ParsedText inline parseLatex parseMarkdown text={quizItem.body} />}
      </div>
      <div>
        <TextField
          id={fieldId}
          aria-labelledby={labelledBy}
          aria-describedby={describedBy}
          type="text"
          className={css`
            label {
              font-weight: 500;
              color: #4c5868;
              font-family: ${primaryFont};
              font-size: 0.938rem;
              margin-bottom: 1rem;
            }
            input {
              background: #f4f5f7 !important;
              border-radius: 0.25rem;
              /* gray[400]: border contrast >= 3:1 against the field background (WCAG 1.4.11). */
              border: 0.188rem solid #767b85 !important;
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

  const validator = new RegExp(validatorRegex.trim())
  return validator.test(cleanedInput)
}

export default withErrorBoundary(ClosedEndedQuestion)
