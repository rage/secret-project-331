import { useTranslation } from "react-i18next"

import withErrorBoundary from "../../shared-module/utils/withErrorBoundary"

import { QuizItemComponentProps } from "."

const Unsupported: React.FC<QuizItemComponentProps> = () => {
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
