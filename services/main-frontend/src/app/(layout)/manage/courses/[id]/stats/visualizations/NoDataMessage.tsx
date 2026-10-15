"use client"

import React from "react"
import { useTranslation } from "react-i18next"

const NoDataMessage: React.FC = () => {
  const { t } = useTranslation()
  return <div>{t("no-data")}</div>
}

export default NoDataMessage
