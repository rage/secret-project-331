import styled from "@emotion/styled"
import React from "react"
import { useTranslation } from "react-i18next"

import { PrivateSpecQuizItemEssay } from "../../../../../../types/quizTypes/privateSpec"
import useQuizzesExerciseServiceOutputState from "../../../../../hooks/useQuizzesExerciseServiceOutputState"
import findQuizItem from "../../utils/general"
import EditorCard from "../common/EditorCard"
import ParsedTextField from "../common/ParsedTextField"

import TextField from "@/shared-module/common/components/InputFields/TextField"

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

  const { selected: totalNumberOfQuizItems } = useQuizzesExerciseServiceOutputState<number>(
    (quiz) => {
      return quiz?.items.length ?? 0
    },
  )

  const showTitleEditor =
    (totalNumberOfQuizItems && totalNumberOfQuizItems > 1) || !!selected?.title

  if (selected === null) {
    return <></>
  }

  return (
    <EditorCard quizItemId={quizItemId} title={t("quiz-essay-name")}>
      {showTitleEditor && (
        <ParsedTextField
          value={selected.title}
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
      <TextFieldContainer>
        <TextFieldWrapper>
          <TextField
            type={"number"}
            value={selected.minWords ?? 0}
            label={t("min-words")}
            name={t("min-words")}
            onChangeByValue={(value) => {
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
            onChangeByValue={(value) => {
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
