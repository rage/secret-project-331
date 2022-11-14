import React from "react"
import { useTranslation } from "react-i18next"

import { PrivateSpecQuizItemMatrix } from "../../../../../types/quizTypes"
import EditorCard from "../common/EditorCard"

import TableContent from "./TableContent"

interface MatrixEditorProps {
  quizItem: PrivateSpecQuizItemMatrix
}

const MatrixEditor: React.FC<MatrixEditorProps> = ({ quizItem }) => {
  const { t } = useTranslation()

  return (
    <EditorCard title={t("quiz-matrix-name")}>
      <TableContent item={quizItem} />
    </EditorCard>
  )
}

export default MatrixEditor
