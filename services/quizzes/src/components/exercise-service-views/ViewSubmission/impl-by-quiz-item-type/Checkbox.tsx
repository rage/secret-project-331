import { css } from "@emotion/css"
import styled from "@emotion/styled"
import React from "react"

import { UserItemAnswerCheckbox } from "../../../../../types/quizTypes/answer"
import { PublicSpecQuizItemCheckbox } from "../../../../../types/quizTypes/publicSpec"

import { QuizItemSubmissionComponentProps } from "."

import { baseTheme } from "@/shared-module/common/styles"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"

interface StyledProps {
  checked: boolean
}

const Option = styled.div<StyledProps>`
  display: flex;
  flex-direction: row;
  flex-wrap: wrap;
  border: 3px solid
    ${({ checked }) => (checked ? baseTheme.colors.green[400] : baseTheme.colors.red[400])};
  border-radius: 3px;
  margin-bottom: 10px;
  padding: 5px;
`

const CheckBoxFeedback: React.FC<
  QuizItemSubmissionComponentProps<PublicSpecQuizItemCheckbox, UserItemAnswerCheckbox>
> = ({ public_quiz_item, user_quiz_item_answer, quiz_item_answer_feedback }) => {
  const checked = user_quiz_item_answer.checked

  return (
    <div>
      <div>
        {checked ? (
          <Option checked={checked}>
            <div
              className={css`
                flex: 0.3;
                margin: 0.5rem;
                display: flex;
                justify-content: flex-end;
              `}
            >
              <input
                type="checkbox"
                checked={checked}
                aria-label={public_quiz_item.title ?? undefined}
              />
            </div>
            <div
              className={css`
                flex: 10;
                margin: 0.5rem;
              `}
            >
              {public_quiz_item.title}
            </div>
          </Option>
        ) : (
          <Option checked={checked}>
            <div
              className={css`
                flex: 0.3;
                margin: 0.5rem;
                display: flex;
                justify-content: flex-end;
              `}
            >
              <input
                type="checkbox"
                checked={checked}
                aria-label={public_quiz_item.title ?? undefined}
              />
            </div>
            <div
              className={css`
                flex: 10;
                margin: 0.5rem;
              `}
            >
              {public_quiz_item.title}
            </div>
          </Option>
        )}
        <div>
          {quiz_item_answer_feedback?.quiz_item_option_feedbacks?.map((of) => (
            <p key={of.option_id}>{of.option_feedback}</p>
          ))}
        </div>
      </div>
    </div>
  )
}

export default withErrorBoundary(CheckBoxFeedback)
