"use client"

import { useTranslation } from "react-i18next"

const BooleanAsYesOrNoText = ({ value }: { value: boolean }) => {
  const { t } = useTranslation()
  return value ? t("yes") : t("no")
}

export default BooleanAsYesOrNoText
