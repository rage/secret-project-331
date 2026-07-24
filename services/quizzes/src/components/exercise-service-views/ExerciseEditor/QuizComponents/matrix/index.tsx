import React from "react"
import { useTranslation } from "react-i18next"

import useQuizzesExerciseServiceOutputState from "@/hooks/useQuizzesExerciseServiceOutputState"

import type { PrivateSpecQuizItemMatrix } from "../../../../../../types/quizTypes/privateSpec"
import findQuizItem from "../../utils/general"
import EditorCard from "../common/EditorCard"
import FeedbackMessagesEditor, {
  useItemFeedbackVisibilityOptions,
} from "../common/FeedbackMessagesEditor"
import ParsedTextField from "../common/ParsedTextField"
import TableContent from "./TableContent"

interface MatrixEditorProps {
  quizItemId: string
}

const MatrixEditor: React.FC<MatrixEditorProps> = ({ quizItemId }) => {
  const { t } = useTranslation()
  const itemFeedbackVisibilityOptions = useItemFeedbackVisibilityOptions()

  const { selected, updateState } = useQuizzesExerciseServiceOutputState<PrivateSpecQuizItemMatrix>(
    (quiz) => {
      // oxlint-disable-next-line i18next/no-literal-string
      return findQuizItem<PrivateSpecQuizItemMatrix>(quiz, quizItemId, "matrix")
    },
  )

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
    <EditorCard quizItemId={quizItemId} title={t("quiz-matrix-name")}>
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
      <TableContent quizItemId={quizItemId} />
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

export default MatrixEditor
