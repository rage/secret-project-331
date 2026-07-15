import styled from "@emotion/styled"
import React from "react"
import { useTranslation } from "react-i18next"

import type { PrivateSpecQuizItemScale } from "../../../../../../types/quizTypes/privateSpec"
import useQuizzesExerciseServiceOutputState from "../../../../../hooks/useQuizzesExerciseServiceOutputState"
import findQuizItem from "../../utils/general"
import EditorCard from "../common/EditorCard"

import TextField from "@/shared-module/common/components/InputFields/TextField"

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
          <TextField
            type={"number"}
            value={selected.minValue ?? 0}
            label={t("minimum")}
            name={t("minimum")}
            onChangeByValue={(minimum) => {
              updateState((draft) => {
                if (!draft) {
                  return
                }
                // oxlint-disable-next-line unicorn/prefer-number-coercion -- parseInt intended; Number() differs
                draft.minValue = parseInt(minimum, 10)
              })
            }}
          />
        </TextFieldWrapper>
        <TextFieldWrapper>
          <TextField
            type={"number"}
            value={selected.maxValue ?? 0}
            label={t("maximum")}
            name={t("maximum")}
            onChangeByValue={(maximum) => {
              updateState((draft) => {
                if (!draft) {
                  return
                }
                // oxlint-disable-next-line unicorn/prefer-number-coercion -- parseInt intended; Number() differs
                draft.maxValue = parseInt(maximum, 10)
              })
            }}
          />
        </TextFieldWrapper>
      </TextFieldContainer>
    </EditorCard>
  )
}

export default ScaleEditor
