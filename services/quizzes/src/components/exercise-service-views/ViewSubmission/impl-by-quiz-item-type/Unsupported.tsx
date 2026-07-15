import React from "react"
import { useTranslation } from "react-i18next"

import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"

import type { QuizItemSubmissionComponentProps } from "."
import type { UserItemAnswer } from "../../../../../types/quizTypes/answer"
import type { PublicSpecQuizItem } from "../../../../../types/quizTypes/publicSpec"

const UnsupportedSubmissionViewComponent: React.FC<
  QuizItemSubmissionComponentProps<PublicSpecQuizItem, UserItemAnswer>
> = () => {
  const { t } = useTranslation()
  return <p>{t("unsupported")}</p>
}

export default withErrorBoundary(UnsupportedSubmissionViewComponent)
