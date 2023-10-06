import React from "react"
import { useTranslation } from "react-i18next"

import EditorCard from "../common/EditorCard"

interface UnsupportedExerciseProps {
  quizItemId: string
}

const UnsupportedExercise: React.FC<UnsupportedExerciseProps> = ({ quizItemId }) => {
  const { t } = useTranslation()

  const title = t("quiz-item-type-not-unsupported-title")

  return (
    <EditorCard quizItemId={quizItemId} title={title}>
      {t("quiz-item-type-not-supported")}
    </EditorCard>
  )
}

export default UnsupportedExercise
