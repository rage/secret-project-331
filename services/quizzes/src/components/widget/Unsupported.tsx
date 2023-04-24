import { useTranslation } from "react-i18next"

import { UserItemAnswer } from "../../../types/quizTypes/answer"
import { PublicSpecQuizItem } from "../../../types/quizTypes/publicSpec"
import withErrorBoundary from "../../shared-module/utils/withErrorBoundary"

import { QuizItemComponentProps } from "."

const Unsupported: React.FC<QuizItemComponentProps<PublicSpecQuizItem, UserItemAnswer>> = () => {
  const { t } = useTranslation()
  return (
    <div>
      <p>{t("unsupported")}</p>
      <p>{t("unsupported")}</p>
      <p>{t("unsupported")}</p>
      <p>{t("unsupported")}</p>
      <p>{t("unsupported")}</p>
      <p>{t("unsupported")}</p>
      <p>{t("unsupported")}</p>
      <p>{t("unsupported")}</p>
      <p>{t("unsupported")}</p>
      <p>{t("unsupported")}</p>
      <p>{t("unsupported")}</p>
      <p>{t("unsupported")}</p>
    </div>
  )
}

export default withErrorBoundary(Unsupported)
