import React from "react"
import { useTranslation } from "react-i18next"

import EditorCard from "../common/EditorCard"

import TimelineContent from "./TimelineContent"

interface TimelineEditorProps {
  quizItemId: string
}

const TimelineEditor: React.FC<TimelineEditorProps> = ({ quizItemId }) => {
  const { t } = useTranslation()

  return (
    <EditorCard quizItemId={quizItemId} title={t("quiz-timeline-name")}>
      <TimelineContent quizItemId={quizItemId} />
    </EditorCard>
  )
}

export default TimelineEditor
