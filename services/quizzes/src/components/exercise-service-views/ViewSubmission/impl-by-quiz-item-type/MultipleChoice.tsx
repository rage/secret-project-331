import { css, cx } from "@emotion/css"
import React from "react"
import { useTranslation } from "react-i18next"

import { UserItemAnswerMultiplechoice } from "../../../../../types/quizTypes/answer"
import { ModelSolutionQuizItemMultiplechoice } from "../../../../../types/quizTypes/modelSolutionSpec"
import { PublicSpecQuizItemMultiplechoice } from "../../../../../types/quizTypes/publicSpec"
import { respondToOrLarger } from "../../../../shared-module/styles/respond"
import withErrorBoundary from "../../../../shared-module/utils/withErrorBoundary"
import { quizTheme } from "../../../../styles/QuizStyles"
import { FlexDirection, sanitizeFlexDirection } from "../../../../util/css-sanitization"
import { orderArrayWithId } from "../../../../util/randomizer"
import MarkdownText from "../../../MarkdownText"
import ParsedText from "../../../ParsedText"

import { QuizItemSubmissionComponentProps } from "."

const gradingOption = css`
  align-items: center;
  background: ${quizTheme.quizItemBackground};
  border: none;
  display: flex;
  flex: 1;
  flex-wrap: wrap;
  justify-content: space-between;
  margin: 0.3rem;
  padding: 0 1rem;
`

// eslint-disable-next-line i18next/no-literal-string
const gradingOptionWrongAndSelected = css`
  background: ${quizTheme.gradingWrongItemBackground};
  color: ${quizTheme.gradingWrongItemColor};
`

// eslint-disable-next-line i18next/no-literal-string
const gradingOptionSelected = css`
  background: ${quizTheme.gradingSelectedItemBackground};
  color: ${quizTheme.gradingSelectedItemColor};
`

// eslint-disable-next-line i18next/no-literal-string
const gradingOptionCorrectAndSelected = css`
  background: ${quizTheme.gradingCorrectItemBackground};
  color: ${quizTheme.gradingCorrectItemColor};
`

const MultipleChoiceSubmission: React.FC<
  React.PropsWithChildren<
    QuizItemSubmissionComponentProps<PublicSpecQuizItemMultiplechoice, UserItemAnswerMultiplechoice>
  >
> = ({
  public_quiz_item,
  quiz_item_model_solution,
  user_quiz_item_answer,
  quiz_item_answer_feedback,
  user_information,
}) => {
  const { t } = useTranslation()

  const modelSolution = quiz_item_model_solution as ModelSolutionQuizItemMultiplechoice
  // Column means that all the options are always diplayed on top of each other, regardless of the
  // device width. Sanitized since the value is used in CSS.
  const direction: FlexDirection = sanitizeFlexDirection(
    public_quiz_item.optionDisplayDirection,
    "row",
  )

  let quiz_options = public_quiz_item.options
  if (public_quiz_item.shuffleOptions) {
    quiz_options = orderArrayWithId(quiz_options, user_information.pseudonymous_id)
  }

  return (
    <div
      className={css`
        margin: 0.5rem;
      `}
    >
      <div
        className={css`
          font-size: ${quizTheme.quizTitleFontSize};
          font-weight: bold;
          font-family: "Raleway", sans-serif;
        `}
      >
        <ParsedText inline parseLatex parseMarkdown text={public_quiz_item.title} />
      </div>
      <p
        className={css`
          color: ${quizTheme.quizBodyColor};
          font-size: ${quizTheme.quizBodyFontSize};
          margin: 0.5rem 0;
        `}
      >
        {public_quiz_item.body && <MarkdownText text={public_quiz_item.body} />}
      </p>
      <div
        className={css`
          display: flex;
          flex-direction: column;

          ${respondToOrLarger.sm} {
            flex-direction: ${direction};
          }
        `}
      >
        {quiz_options.map((qo) => {
          const selectedAnswer = user_quiz_item_answer.selectedOptionIds?.includes(qo.id) ?? false
          const modelSolutionForThisOption =
            modelSolution?.options.find((x) => x.id === qo.id) ?? null
          // If correctAnswer is null we don't know whether this option was correct or not
          let correctAnswer = modelSolutionForThisOption?.correct ?? null
          const feedbackForThisOption = quiz_item_answer_feedback?.quiz_item_option_feedbacks?.find(
            (f) => f.option_id === qo.id,
          )
          if (feedbackForThisOption && feedbackForThisOption.this_option_was_correct !== null) {
            // if we have received feedback for this option, use that
            // However, if the model solution thinks this option is correct and the feedback says it's not, we'll trust the model solution
            if (!correctAnswer) {
              correctAnswer = feedbackForThisOption.this_option_was_correct
            }
          }
          return (
            <>
              <div>
                <div
                  key={qo.id}
                  className={cx(
                    gradingOption,
                    selectedAnswer && gradingOptionSelected,
                    selectedAnswer && correctAnswer === false && gradingOptionWrongAndSelected,
                    selectedAnswer && correctAnswer === true && gradingOptionCorrectAndSelected,
                  )}
                >
                  <div
                    className={css`
                      padding: 1rem 0;
                      max-width: 50ch;
                    `}
                  >
                    <ParsedText inline parseMarkdown parseLatex text={qo.title || qo.body || ""} />
                  </div>
                  <div>
                    <div
                      className={css`
                        display: flex;
                        flex-direction: ${sanitizeFlexDirection(
                          public_quiz_item.optionDisplayDirection,
                          "row",
                        )};
                      `}
                    >
                      <div>{correctAnswer == true && t("correct-option")}</div>
                      <div>{correctAnswer == false && t("incorrect-option")}</div>
                    </div>
                  </div>
                </div>
                <RowSubmissionFeedback
                  correct={correctAnswer ?? false}
                  feedback={
                    selectedAnswer
                      ? feedbackForThisOption?.option_feedback
                      : modelSolutionForThisOption?.additionalCorrectnessExplanationOnModelSolution
                  }
                />
              </div>
            </>
          )
        })}
      </div>
    </div>
  )
}

interface RowSubmissionFeedbackProps {
  feedback: string | null | undefined
  correct: boolean
}

const RowSubmissionFeedback: React.FC<React.PropsWithChildren<RowSubmissionFeedbackProps>> = ({
  feedback,
  correct,
}) => {
  return feedback ? (
    <div
      className={css`
        margin: 0 0.5rem 1rem;
        display: flex;
        border-left: ${correct
          ? `6px solid ${quizTheme.gradingCorrectItemBackground}`
          : `6px solid ${quizTheme.gradingWrongItemBackground}`};
        box-sizing: border-box;
        background: ${quizTheme.feedbackBackground};
        padding: 0.5rem 0px 0.5rem 0.5rem;
      `}
    >
      <p>{feedback}</p>
    </div>
  ) : null
}

export default withErrorBoundary(MultipleChoiceSubmission)
