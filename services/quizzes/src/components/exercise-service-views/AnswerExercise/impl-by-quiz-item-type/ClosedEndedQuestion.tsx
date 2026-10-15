import { css } from "@emotion/css"
import React, { useCallback, useId } from "react"
import { useTranslation } from "react-i18next"

import TextField from "@/shared-module/common/components/InputFields/TextField"
import { includeIf } from "@/shared-module/common/utils/nullability"
import { stripNonPrintableCharacters } from "@/shared-module/common/utils/strings"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"
import { baseTheme, primaryFont } from "@/shared-module/exercise-react/styles"

import type { QuizItemComponentProps } from "."
import type { UserItemAnswerClosedEndedQuestion } from "../../../../../types/quizTypes/answer"
import type { PublicSpecQuizItemClosedEndedQuestion } from "../../../../../types/quizTypes/publicSpec"
import ParsedText from "../../../ParsedText"
import CloseEndedQuestionWrapper from "../../../Shared/CloseEndedQuestionWrapper"

const ClosedEndedQuestion: React.FC<
  QuizItemComponentProps<PublicSpecQuizItemClosedEndedQuestion, UserItemAnswerClosedEndedQuestion>
> = ({ quizDirection, quizItem, quizItemAnswerState, setQuizItemAnswerState }) => {
  const { t } = useTranslation()
  const fieldId = useId()
  const titleId = useId()
  const bodyId = useId()
  // Fall back to body as the accessible name when there's no title.
  const labelledBy = quizItem.title ? titleId : quizItem.body ? bodyId : undefined
  const describedBy = quizItem.title && quizItem.body ? bodyId : undefined

  const validateAnswer = useCallback(
    (answer: string) => {
      if (quizItem.formatRegex) {
        return answer.length > 0 && answerFormatIsValidAgainstRegex(answer, quizItem.formatRegex)
      }
      return answer.length > 0
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
          aria-label={labelledBy ? undefined : t("answer")}
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
              /* gray[400] for sufficient contrast against the field background */
              border: 0.188rem solid ${baseTheme.colors.gray[400]} !important;
            }
          `}
          value={quizItemAnswerState?.textData ?? ""}
          onChangeByValue={(e) => handleChange(e)}
          {...includeIf(formatErrorVisible, {
            error: t("error-answer-does-not-match-the-specified-answer-format"),
          })}
        />
      </div>
    </CloseEndedQuestionWrapper>
  )
}

const answerFormatIsValidAgainstRegex = (
  answer: string | undefined,
  validatorRegex: string | undefined,
): boolean => {
  if (answer?.length === 0) {
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
