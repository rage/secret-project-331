import { css } from "@emotion/css"
import styled from "@emotion/styled"
import React from "react"

import { ItemAnswerFeedback } from "../../pages/api/grade"
import { baseTheme } from "../../shared-module/styles"

import { QuizItemSubmissionComponentProps } from "."

interface StyledProps {
  correct: boolean
}

const Option = styled.div<StyledProps>`
  display: flex;
  flex-direction: row;
  flex-wrap: wrap;
  border: 3px solid
    ${({ correct }) => (correct ? baseTheme.colors.green[400] : baseTheme.colors.red[400])};
  border-radius: 3px;
  margin-bottom: 10px;
  padding: 5px;
`

const CheckBoxFeedback: React.FC<QuizItemSubmissionComponentProps> = ({
  public_quiz_item,
  user_quiz_item_answer,
  quiz_item_feedback,
}) => {
  const correct = user_quiz_item_answer.intData === 1

  return (
    <div>
      <div>
        {correct ? (
          <Option correct={correct}>
            <div
              className={css`
                flex: 0.3;
                margin: 0.5rem;
                display: flex;
                justify-content: flex-end;
              `}
            >
              <input type="checkbox" checked={correct} aria-label={public_quiz_item.title} />
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
          <Option correct={correct}>
            <div
              className={css`
                flex: 0.3;
                margin: 0.5rem;
                display: flex;
                justify-content: flex-end;
              `}
            >
              <input type="checkbox" checked={correct} aria-label={public_quiz_item.title} />
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
          {(quiz_item_feedback as ItemAnswerFeedback).quiz_item_option_feedbacks?.map((of) => (
            <p key={of.option_id}>{of.option_feedback}</p>
          ))}
        </div>
      </div>
    </div>
  )
}

export default CheckBoxFeedback
