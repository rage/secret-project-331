import { css } from "@emotion/css"
import React from "react"
import { useTranslation } from "react-i18next"

import { UserItemAnswerMultiplechoiceDropdown } from "../../../../../types/quizTypes/answer"
import { ItemAnswerFeedback } from "../../../../../types/quizTypes/grading"
import { ModelSolutionQuizItemMultiplechoiceDropdown } from "../../../../../types/quizTypes/modelSolutionSpec"
import {
  PublicQuizItemOption,
  PublicSpecQuizItemMultiplechoiceDropdown,
} from "../../../../../types/quizTypes/publicSpec"
import { respondToOrLarger } from "../../../../shared-module/styles/respond"
import withErrorBoundary from "../../../../shared-module/utils/withErrorBoundary"
import { quizTheme } from "../../../../styles/QuizStyles"

import { QuizItemSubmissionComponentProps } from "."

const MultipleChoiceDropdownFeedback: React.FC<
  React.PropsWithChildren<
    QuizItemSubmissionComponentProps<
      PublicSpecQuizItemMultiplechoiceDropdown,
      UserItemAnswerMultiplechoiceDropdown
    >
  >
> = ({
  public_quiz_item,
  user_quiz_item_answer,
  quiz_item_answer_feedback,
  quiz_item_model_solution,
}) => {
  const { t } = useTranslation()

  const modelSolution = quiz_item_model_solution as ModelSolutionQuizItemMultiplechoiceDropdown
  const correct = quiz_item_answer_feedback
    ? quiz_item_answer_feedback?.score === 1 ??
      quiz_item_answer_feedback.correctnessCoefficient == 1
    : false
  const selectedOption = public_quiz_item.options.filter(
    (o) => o.id === (user_quiz_item_answer.selectedOptionIds as string[])[0],
  )[0]
  const correctOption = modelSolution?.options.find((o) => o.correct)
  const quiz_options = public_quiz_item.options

  return (
    <div>
      <div
        className={css`
          display: flex;
          flex: 1;
          flex-direction: column;
          justify-content: space-between;
          align-items: center;
          ${respondToOrLarger.sm} {
            flex-direction: row;
          }
        `}
      >
        <div
          className={css`
            flex-direction: column;
            width: 70%;
          `}
        >
          <div
            className={css`
              margin: 0.5rem 0;
              margin-bottom: 0;
            `}
          >
            {public_quiz_item.title ? (
              <>
                <h2
                  className={css`
                    font-family: "Raleway", sans-serif;
                    font-weight: bold;
                    font-size: ${quizTheme.quizTitleFontSize} !important;
                  `}
                >
                  {public_quiz_item.title}
                </h2>
              </>
            ) : null}
          </div>
          {public_quiz_item.body && (
            <div
              className={css`
                margin: 0.5rem;
              `}
            >
              {public_quiz_item.body ? (
                <>
                  <h3
                    className={css`
                      font-size: clamp(18px, 2vw, 20px) !important;
                    `}
                  >
                    {public_quiz_item.body}
                  </h3>
                </>
              ) : null}
            </div>
          )}
        </div>
        <div
          className={css`
            display: flex;
            width: 30%;
            align-items: center;
            margin: 0.5rem 0;
          `}
        >
          <select
            aria-label={t("answer")}
            disabled
            className={css`
              display: grid;
              width: 100%;
              border: 1px solid #e0e0e0;
              border-radius: 3px;
              padding: 10px 12px;
              font-size: 18px;
              cursor: not-allowed;
              background: ${correct
                ? quizTheme.gradingCorrectItemBackground
                : quizTheme.gradingWrongItemBackground};
              color: white;
              grid-template-areas: "select";
              align-items: center;
              margin-left: 0.5rem;
            `}
          >
            <option
              disabled
              selected={selectedOption.id === null}
              value=""
              className={css`
                display: flex;
              `}
            >
              {t("answer")}
            </option>
            {public_quiz_item.options.map((o) => (
              <option
                key={o.id}
                value={o.id}
                selected={selectedOption.id === o.id}
                className={css`
                  display: flex;
                `}
              >
                {o.title || o.body}
              </option>
            ))}
          </select>
        </div>
      </div>

      {correctOption && (
        <div>
          <div
            className={css`
              display: flex;
            `}
          >
            <div
              className={css`
                width: 70%;
              `}
            >
              &nbsp;
            </div>
            <div
              className={css`
                margin-left: 0.5rem;
                margin-bottom: 1rem;
              `}
            >
              {t("correct-option")}: {correctOption?.title || correctOption?.body}
            </div>
          </div>
          <SubmissionFeedbackMessage
            quiz_options={quiz_options}
            user_quiz_item_answer={user_quiz_item_answer}
            modelSolution={modelSolution}
            quiz_item_answer_feedback={quiz_item_answer_feedback ?? null}
          />
        </div>
      )}
    </div>
  )
}

interface SubmissionFeedbackMessageProps {
  quiz_options: PublicQuizItemOption[]
  user_quiz_item_answer: UserItemAnswerMultiplechoiceDropdown
  modelSolution: ModelSolutionQuizItemMultiplechoiceDropdown
  quiz_item_answer_feedback: ItemAnswerFeedback | null
}

const SubmissionFeedbackMessage: React.FC<
  React.PropsWithChildren<SubmissionFeedbackMessageProps>
> = ({ quiz_options, user_quiz_item_answer, modelSolution, quiz_item_answer_feedback }) => {
  return quiz_options.map((option) => {
    const answerSelectedThisOption =
      user_quiz_item_answer.selectedOptionIds?.includes(option.id) ?? false
    const modelSolutionForThisOption =
      modelSolution?.options.find((x) => x.id === option.id) ?? null
    // If correctAnswer is null we don't know whether this option was correct or not
    let correctAnswer = modelSolutionForThisOption?.correct ?? null
    const feedbackForThisOption = quiz_item_answer_feedback?.quiz_item_option_feedbacks?.find(
      (feedback) => feedback.option_id === option.id,
    )
    if (feedbackForThisOption && feedbackForThisOption.this_option_was_correct !== null) {
      // if we have received feedback for this option, use that
      // However, if the model solution thinks this option is correct and the feedback says it's not, we'll trust the model solution
      if (!correctAnswer) {
        correctAnswer = feedbackForThisOption.this_option_was_correct
      }
    }
    let feedBackForOption: string | null = null
    if (answerSelectedThisOption) {
      feedBackForOption = feedbackForThisOption?.option_feedback ?? null
      if (modelSolutionForThisOption?.additionalCorrectnessExplanationOnModelSolution) {
        feedBackForOption =
          modelSolutionForThisOption.additionalCorrectnessExplanationOnModelSolution
      }
    }
    return feedBackForOption ? (
      <div
        className={css`
          margin: 0 0.5rem 1rem;
          display: flex;
          border-left: ${correctAnswer
            ? `6px solid ${quizTheme.gradingCorrectItemBackground}`
            : `6px solid ${quizTheme.gradingWrongItemBackground}`};
          box-sizing: border-box;
          background: ${quizTheme.feedbackBackground};
          padding: 0.5rem 0px 0.5rem 0.5rem;
        `}
      >
        <p>{feedBackForOption}</p>
      </div>
    ) : null
  })
}

export default withErrorBoundary(MultipleChoiceDropdownFeedback)
