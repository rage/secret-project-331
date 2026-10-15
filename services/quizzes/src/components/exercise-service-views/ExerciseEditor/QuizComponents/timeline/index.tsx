import React from "react"
import { useTranslation } from "react-i18next"

import useQuizzesExerciseServiceOutputState from "@/hooks/useQuizzesExerciseServiceOutputState"

import type { PrivateSpecQuizItemTimeline } from "../../../../../../types/quizTypes/privateSpec"
import findQuizItem from "../../utils/general"
import EditorCard from "../common/EditorCard"
import FeedbackMessagesEditor, {
  useItemFeedbackVisibilityOptions,
} from "../common/FeedbackMessagesEditor"
import ParsedTextField from "../common/ParsedTextField"
import TimelineContent from "./TimelineContent"

interface TimelineEditorProps {
  quizItemId: string
}

const TimelineEditor: React.FC<TimelineEditorProps> = ({ quizItemId }) => {
  const { t } = useTranslation()
  const itemFeedbackVisibilityOptions = useItemFeedbackVisibilityOptions()

  const { selected, updateState } =
    useQuizzesExerciseServiceOutputState<PrivateSpecQuizItemTimeline>((quiz) => {
      // oxlint-disable-next-line i18next/no-literal-string
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
      <FeedbackMessagesEditor
        value={selected.feedbackMessages}
        visibilityOptions={itemFeedbackVisibilityOptions}
        onChange={(feedbackMessages) => {
          updateState((draft) => {
            if (!draft) {
              return
            }
            draft.feedbackMessages = feedbackMessages
          })
        }}
      />
    </EditorCard>
  )
}

export default TimelineEditor
