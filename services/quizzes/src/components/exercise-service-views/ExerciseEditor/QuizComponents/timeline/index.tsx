import React from "react"
import { useTranslation } from "react-i18next"

import { PrivateSpecQuizItemTimeline } from "../../../../../../types/quizTypes/privateSpec"
import findQuizItem from "../../utils/general"
import EditorCard from "../common/EditorCard"
import ParsedTextField from "../common/ParsedTextField"

import TimelineContent from "./TimelineContent"

import useQuizzesExerciseServiceOutputState from "@/hooks/useQuizzesExerciseServiceOutputState"

interface TimelineEditorProps {
  quizItemId: string
}

const TimelineEditor: React.FC<TimelineEditorProps> = ({ quizItemId }) => {
  const { t } = useTranslation()

  const { selected, updateState } =
    useQuizzesExerciseServiceOutputState<PrivateSpecQuizItemTimeline>((quiz) => {
      // eslint-disable-next-line i18next/no-literal-string
      return findQuizItem<PrivateSpecQuizItemTimeline>(quiz, quizItemId, "timeline")
    })

  const { selected: totalNumberOfQuizItems } = useQuizzesExerciseServiceOutputState<number>(
    (quiz) => {
      return quiz?.items.length ?? 0
    },
  )

  if (!selected) {
    return null
  }

  const showTitleEditor =
    (totalNumberOfQuizItems && totalNumberOfQuizItems > 1) || !!selected?.title

  return (
    <EditorCard quizItemId={quizItemId} title={t("quiz-timeline-name")}>
      {showTitleEditor && (
        <ParsedTextField
          value={selected.title ?? null}
          onChange={(title) => {
            updateState((draft) => {
              if (!draft) {
                return
              }
              draft.title = title
            })
          }}
          label={t("title")}
        />
      )}
      <TimelineContent quizItemId={quizItemId} />
    </EditorCard>
  )
}

export default TimelineEditor
