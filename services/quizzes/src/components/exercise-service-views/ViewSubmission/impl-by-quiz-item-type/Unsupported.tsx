import React from "react"
import { useTranslation } from "react-i18next"

import type { UserItemAnswer } from "../../../../../types/quizTypes/answer"
import type { PublicSpecQuizItem } from "../../../../../types/quizTypes/publicSpec"

import type { QuizItemSubmissionComponentProps } from "."

import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"

const UnsupportedSubmissionViewComponent: React.FC<
  QuizItemSubmissionComponentProps<PublicSpecQuizItem, UserItemAnswer>
> = () => {
  const { t } = useTranslation()
  return <p>{t("unsupported")}</p>
}

export default withErrorBoundary(UnsupportedSubmissionViewComponent)
