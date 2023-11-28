import React, { useId } from "react"
import { useTranslation } from "react-i18next"

import { UserItemAnswerClosedEndedQuestion } from "../../../../../types/quizTypes/answer"
import { PublicSpecQuizItemClosedEndedQuestion } from "../../../../../types/quizTypes/publicSpec"
import TextField from "../../../../shared-module/components/InputFields/TextField"
import withErrorBoundary from "../../../../shared-module/utils/withErrorBoundary"
import MarkdownText from "../../../MarkdownText"
import CloseEndedQuestionWrapper from "../../../Shared/CloseEndedQuestionWrapper"

import { QuizItemSubmissionComponentProps } from "."

const ClosedEndedQuestionFeedback: React.FC<
  QuizItemSubmissionComponentProps<
    PublicSpecQuizItemClosedEndedQuestion,
    UserItemAnswerClosedEndedQuestion
  >
> = ({ public_quiz_item, quiz_direction, user_quiz_item_answer }) => {
  const { t } = useTranslation()
  const fieldId = useId()
  return (
    <CloseEndedQuestionWrapper wideScreenDirection={quiz_direction}>
      <div>{public_quiz_item.title && <MarkdownText text={public_quiz_item.title} />}</div>
      <div>{public_quiz_item.body && <MarkdownText text={public_quiz_item.body} />}</div>
      <div>
        <TextField
          id={fieldId}
          type="text"
          disabled
          label={t("answer")}
          value={user_quiz_item_answer.textData ?? ""}
        />
      </div>
    </CloseEndedQuestionWrapper>
  )
}

export default withErrorBoundary(ClosedEndedQuestionFeedback)
