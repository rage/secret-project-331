"use client"
import { useTranslation } from "react-i18next"

export default function NotFound() {
  const { t } = useTranslation()
  return (
    <div>
      <h2>{t("not-found")}</h2>
      <p>{t("could-not-find-requested-resource")}</p>
    </div>
  )
}
