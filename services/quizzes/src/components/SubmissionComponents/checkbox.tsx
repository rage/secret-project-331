import React from "react"

import { ItemAnswerFeedback } from "../../pages/api/grade"

import { QuizItemSubmissionComponentProps } from "."

const CheckBoxFeedback: React.FC<QuizItemSubmissionComponentProps> = ({
  public_quiz_item,
  user_quiz_item_answer,
  quiz_item_model_solution,
  quiz_item_feedback,
}) => {
  const correct = (quiz_item_feedback as ItemAnswerFeedback).quiz_item_correct
  const checkedOption = public_quiz_item.options.filter(
    (o) => o.id === (user_quiz_item_answer.optionAnswers as string[])[0],
  )[0]
  const correctOption = quiz_item_model_solution?.options.find((o) => o.correct)

  return (
    <div>
      <h2>{public_quiz_item.title}</h2>
      <div>
        {correct ? (
          <div>{checkedOption.title || checkedOption.body}</div>
        ) : (
          <div>
            <div>{checkedOption.title || checkedOption.body}</div>
            <div>{correctOption?.title || correctOption?.body}</div>
          </div>
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
