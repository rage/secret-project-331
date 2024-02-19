import { css, cx } from "@emotion/css"
import React, { useId } from "react"
import { useTranslation } from "react-i18next"

import { UserItemAnswerClosedEndedQuestion } from "../../../../../types/quizTypes/answer"
import { PublicSpecQuizItemClosedEndedQuestion } from "../../../../../types/quizTypes/publicSpec"
import TextField from "../../../../shared-module/components/InputFields/TextField"
import withErrorBoundary from "../../../../shared-module/utils/withErrorBoundary"
import { quizTheme } from "../../../../styles/QuizStyles"
import ParsedText from "../../../ParsedText"
import CloseEndedQuestionWrapper from "../../../Shared/CloseEndedQuestionWrapper"

import { QuizItemSubmissionComponentProps } from "."

const FEEDBACK_STYLES = `
  display: flex;
  align-items: center;
  margin-top: 1rem;
  margin-bottom: 1rem;
  padding: 1rem;
  border-radius: 5px;
`

// eslint-disable-next-line i18next/no-literal-string
const correctAnswer = css`
  ${FEEDBACK_STYLES}
  background-color: ${quizTheme.successItemBackgroundColor};
  color: ${quizTheme.successItemForegroundColor};
`

// eslint-disable-next-line i18next/no-literal-string
const incorrectAnswer = css`
  ${FEEDBACK_STYLES}
  background-color: ${quizTheme.errorItemBackgroundColor};
  color: ${quizTheme.errorItemForegroundColor};
`

const ClosedEndedQuestionFeedback: React.FC<
  QuizItemSubmissionComponentProps<
    PublicSpecQuizItemClosedEndedQuestion,
    UserItemAnswerClosedEndedQuestion
  >
> = ({ public_quiz_item, quiz_direction, quiz_item_answer_feedback, user_quiz_item_answer }) => {
  const { t } = useTranslation()
  const correct = quiz_item_answer_feedback?.correctnessCoefficient == 1
  const fieldId = useId()
  const item_feedback = quiz_item_answer_feedback?.quiz_item_feedback
  return (
    <CloseEndedQuestionWrapper wideScreenDirection={quiz_direction}>
      <div>
        {public_quiz_item.title && (
          <ParsedText inline parseLatex parseMarkdown text={public_quiz_item.title} />
        )}
      </div>
      <div>
        {public_quiz_item.body && (
          <ParsedText inline parseLatex parseMarkdown text={public_quiz_item.body} />
        )}
      </div>
      <div>
        <TextField
          id={fieldId}
          type="text"
          disabled
          label={t("answer")}
          value={user_quiz_item_answer.textData ?? ""}
          className={css`
            input {
              border-radius: 0.25rem;
              border: 0.188rem solid #dfe1e6 !important;
            }
          `}
        />
      </div>
      <div
        className={css`
          display: flex;
          justify-content: center;
        `}
      >
        {item_feedback && item_feedback.trim() !== "" && (
          <div className={cx(correct ? correctAnswer : incorrectAnswer)}>
            <p>{item_feedback}</p>
          </div>
        )}
      </div>
    </CloseEndedQuestionWrapper>
  )
}

export default withErrorBoundary(ClosedEndedQuestionFeedback)
