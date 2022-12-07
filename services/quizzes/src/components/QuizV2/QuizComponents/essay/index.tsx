import styled from "@emotion/styled"
import React from "react"
import { useTranslation } from "react-i18next"

import { PrivateSpecQuizItemEssay } from "../../../../../types/quizTypes"
import useQuizzesExerciseServiceOutputState from "../../../../hooks/useQuizzesExerciseServiceOutputState"
import TextField from "../../../../shared-module/components/InputFields/TextField"
import findQuizItem from "../../utils/general"
import EditorCard from "../common/EditorCard"

interface EssayEditorProps {
  quizItemId: string
}

const TextFieldContainer = styled.div`
  display: flex;
`

const TextFieldWrapper = styled.div`
  width: 90%;
  margin: 0px 4px;
`

const EssayEditor: React.FC<EssayEditorProps> = ({ quizItemId }) => {
  const { t } = useTranslation()

  const { selected, updateState } = useQuizzesExerciseServiceOutputState<PrivateSpecQuizItemEssay>(
    (quiz) => {
      // eslint-disable-next-line i18next/no-literal-string
      return findQuizItem<PrivateSpecQuizItemEssay>(quiz, quizItemId, "essay")
    },
  )

  if (selected === null) {
    return <></>
  }

  return (
    <EditorCard quizItemId={quizItemId} title={t("quiz-essay-name")}>
      <TextFieldContainer>
        <TextFieldWrapper>
          <TextField
            type={"number"}
            value={selected.minWords ?? 0}
            label={t("min-words")}
            name={t("min-words")}
            onChange={(value) => {
              updateState((draft) => {
                if (!draft) {
                  return
                }
                draft.minWords = Number(value)
              })
            }}
          />
        </TextFieldWrapper>
        <TextFieldWrapper>
          <TextField
            type={"number"}
            value={selected.maxWords ?? 0}
            label={t("max-words")}
            name={t("max-words")}
            onChange={(value) => {
              updateState((draft) => {
                if (!draft) {
                  return
                }
                draft.maxWords = Number(value)
              })
            }}
          />
        </TextFieldWrapper>
      </TextFieldContainer>
    </EditorCard>
  )
}

export default EssayEditor
