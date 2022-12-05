import React from "react"
import { useTranslation } from "react-i18next"

import EditorCard from "../common/EditorCard"

import TableContent from "./TableContent"

interface MatrixEditorProps {
  quizItemId: string
}

const MatrixEditor: React.FC<MatrixEditorProps> = ({ quizItemId }) => {
  const { t } = useTranslation()

  return (
    <EditorCard title={t("quiz-matrix-name")}>
      <TableContent quizItemId={quizItemId} />
    </EditorCard>
  )
}

export default MatrixEditor
