import styled from "@emotion/styled"
import React from "react"
import { useTranslation } from "react-i18next"

import TextField from "@/shared-module/common/components/InputFields/TextField"

import type { PrivateSpecQuizItemScale } from "../../../../../../types/quizTypes/privateSpec"
import useQuizzesExerciseServiceOutputState from "../../../../../hooks/useQuizzesExerciseServiceOutputState"
import findQuizItem from "../../utils/general"
import EditorCard from "../common/EditorCard"
import FeedbackMessagesEditor, {
  useItemFeedbackVisibilityOptions,
} from "../common/FeedbackMessagesEditor"
import NumericField from "../common/NumericField"

interface ScaleEditorProps {
  quizItemId: string
}

const TextFieldContainer = styled.div`
  display: flex;
`

const TextFieldWrapper = styled.div`
  width: 90%;
  margin: 0px 4px;
`

const ScaleEditor: React.FC<ScaleEditorProps> = ({ quizItemId }) => {
  const { t } = useTranslation()
  const itemFeedbackVisibilityOptions = useItemFeedbackVisibilityOptions()

  const { selected, updateState } = useQuizzesExerciseServiceOutputState<PrivateSpecQuizItemScale>(
    (quiz) => {
      return findQuizItem<PrivateSpecQuizItemScale>(quiz, quizItemId, "scale")
    },
  )

  if (selected === null) {
    return null
  }
  return (
    <EditorCard quizItemId={quizItemId} title={t("quiz-scale-name")}>
      <TextField
        onChangeByValue={(title) => {
          updateState((draft) => {
            if (!draft) {
              return
            }
            draft.title = title
          })
        }}
        value={selected.title ?? undefined}
        label={t("option-title")}
        name={t("option-title")}
      />
      <TextFieldContainer>
        <TextFieldWrapper>
          <NumericField
            value={selected.minValue ?? 0}
            label={t("minimum")}
            onCommit={(next) => {
              updateState((draft) => {
                if (!draft) {
                  return
                }
                draft.minValue = next
              })
            }}
          />
        </TextFieldWrapper>
        <TextFieldWrapper>
          <NumericField
            value={selected.maxValue ?? 0}
            label={t("maximum")}
            onCommit={(next) => {
              updateState((draft) => {
                if (!draft) {
                  return
                }
                draft.maxValue = next
              })
            }}
          />
        </TextFieldWrapper>
      </TextFieldContainer>
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

export default ScaleEditor
