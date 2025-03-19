import { css, cx } from "@emotion/css"
import React, { useId } from "react"
import { useTranslation } from "react-i18next"

import { UserItemAnswerClosedEndedQuestion } from "../../../../../types/quizTypes/answer"
import { PublicSpecQuizItemClosedEndedQuestion } from "../../../../../types/quizTypes/publicSpec"
import { quizTheme } from "../../../../styles/QuizStyles"
import ParsedText from "../../../ParsedText"
import CloseEndedQuestionWrapper from "../../../Shared/CloseEndedQuestionWrapper"

import { QuizItemSubmissionComponentProps } from "."

import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"

const FEEDBACK_STYLES = `
  display: flex;
  align-items: center;
  margin-top: 1rem;
  margin-bottom: 1rem;
  padding: 1rem;
  border-radius: 5px;
`

const correctAnswer = css`
  ${FEEDBACK_STYLES}
  background-color: ${quizTheme.successItemBackgroundColor};
  color: ${quizTheme.successItemForegroundColor};
`

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
      <div
        className={css`
          margin-bottom: 1rem;
        `}
      >
        <label
          htmlFor={fieldId}
          className={css`
            display: block;
            margin-bottom: 0.5rem;
            font-weight: 500;
          `}
        >
          {t("answer")}
        </label>
        <p
          id={fieldId}
          className={css`
            padding: 0.5rem;
            border-radius: 0.25rem;
            border: 0.188rem solid #dfe1e6;
            background-color: #f4f5f7;
            min-height: 1.5rem;
            margin: 0;
          `}
        >
          {user_quiz_item_answer.textData ?? ""}
        </p>
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
