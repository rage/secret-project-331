import React from "react"
import { useTranslation } from "react-i18next"

import EditorCard from "../common/EditorCard"

const UnsupportedExercise = () => {
  const { t } = useTranslation()

  const title = t("quiz-item-type-not-unsupported-title")

  return <EditorCard title={title}>{t("quiz-item-type-not-supported")}</EditorCard>
}

export default UnsupportedExercise
