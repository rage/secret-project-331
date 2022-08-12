import React from "react"
import { useTranslation } from "react-i18next"

import withErrorBoundary from "../../shared-module/utils/withErrorBoundary"

import { QuizItemSubmissionComponentProps } from "."

const UnsupportedSubmissionViewComponent: React.FC<QuizItemSubmissionComponentProps> = () => {
  const { t } = useTranslation()
  return <p>{t("unsupported")}</p>
}

export default withErrorBoundary(UnsupportedSubmissionViewComponent)
