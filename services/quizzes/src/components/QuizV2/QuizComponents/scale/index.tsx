import styled from "@emotion/styled"
import React from "react"
import { useTranslation } from "react-i18next"

import { PrivateSpecQuizItemScale } from "../../../../../types/quizTypes/privateSpec"
import useQuizzesExerciseServiceOutputState from "../../../../hooks/useQuizzesExerciseServiceOutputState"
import TextField from "../../../../shared-module/components/InputFields/TextField"
import findQuizItem from "../../utils/general"
import EditorCard from "../common/EditorCard"

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
      // eslint-disable-next-line i18next/no-literal-string
      return findQuizItem<PrivateSpecQuizItemScale>(quiz, quizItemId, "scale")
    },
  )

  if (selected === null) {
    return <></>
  }
  return (
    <EditorCard quizItemId={quizItemId} title={t("quiz-scale-name")}>
      <TextField
        onChange={(title) => {
          updateState((draft) => {
            if (!draft) {
              return
            }
            draft.title = title
          })
        }}
        value={selected.title}
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
            onChange={(minimum) => {
              updateState((draft) => {
                if (!draft) {
                  return
                }
                draft.minValue = parseInt(minimum)
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
            onChange={(maximum) => {
              updateState((draft) => {
                if (!draft) {
                  return
                }
                draft.maxValue = parseInt(maximum)
              })
            }}
          />
        </TextFieldWrapper>
      </TextFieldContainer>
    </EditorCard>
  )
}

export default ScaleEditor
