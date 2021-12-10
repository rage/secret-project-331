import React from "react"
import { useTranslation } from "react-i18next"

const UnsupportedSubmissionViewComponent = () => {
  const { t } = useTranslation()
  return <p>{t("unsupported")}</p>
}

export default UnsupportedSubmissionViewComponent
