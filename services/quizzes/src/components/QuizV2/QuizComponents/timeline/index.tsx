import React from "react"
import { useTranslation } from "react-i18next"

import { PrivateSpecQuizItemTimeline } from "../../../../../types/quizTypes"
import EditorCard from "../common/EditorCard"

import TimelineContent from "./TimelineContent"

interface TimelineEditorProps {
  quizItem: PrivateSpecQuizItemTimeline
}

const TimelineEditor: React.FC<TimelineEditorProps> = ({ quizItem }) => {
  const { t } = useTranslation()

  return (
    <EditorCard title={t("quiz-timeline-name")}>
      <TimelineContent item={quizItem} />
    </EditorCard>
  )
}

export default TimelineEditor
