import React from "react"
import { useTranslation } from "react-i18next"

import { UserItemAnswer } from "../../../../../types/quizTypes/answer"
import { PublicSpecQuizItem } from "../../../../../types/quizTypes/publicSpec"
import withErrorBoundary from "../../../../shared-module/utils/withErrorBoundary"

import { QuizItemSubmissionComponentProps } from "."

const UnsupportedSubmissionViewComponent: React.FC<
  QuizItemSubmissionComponentProps<PublicSpecQuizItem, UserItemAnswer>
> = () => {
  const { t } = useTranslation()
  return <p>{t("unsupported")}</p>
}

export default withErrorBoundary(UnsupportedSubmissionViewComponent)
